(function () {
    "use strict";

    var shell = document.getElementById("deckShell");
    var track = document.getElementById("deckTrack");
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));
    var progressFill = document.getElementById("progressFill");
    var slideCounter = document.getElementById("slideCounter");
    var horizontalTween = null;
    // Touch devices use one continuous vertical document.
    var mobileQuery = window.matchMedia("(hover: none) and (pointer: coarse)");
    var compactQuery = window.matchMedia("(max-width: 1200px)");
    var activeIndex = 0;
    var verticalLayout = false;
    var progressFramePending = false;

    function setViewportUnit() {
        var vh = window.innerHeight * 0.01;
        document.documentElement.style.setProperty("--app-vh", vh + "px");
    }

    function clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    }

    function alignTimelineHonors() {
        var grid = document.querySelector(".slide-3 .timeline-grid");

        if (!grid) {
            return;
        }

        var cards = Array.prototype.slice.call(grid.querySelectorAll(".timeline-card"));
        var notes = Array.prototype.slice.call(grid.querySelectorAll(".timeline-note"));

        if (compactQuery.matches) {
            notes.forEach(function (note) {
                note.style.removeProperty("left");
            });
            return;
        }

        if (cards.length < 4 || notes.length < 3) {
            return;
        }

        [[0, 1], [1, 2], [2, 3]].forEach(function (pair, i) {
            var leftCard = cards[pair[0]];
            var rightCard = cards[pair[1]];
            var note = notes[i];

            if (!leftCard || !rightCard || !note) {
                return;
            }

            var leftCenter = leftCard.offsetLeft + leftCard.offsetWidth / 2;
            var rightCenter = rightCard.offsetLeft + rightCard.offsetWidth / 2;
            var midpoint = (leftCenter + rightCenter) / 2;

            note.style.left = midpoint + "px";
        });
    }

    function toSentenceList(text) {
        var normalized = (text || "").replace(/\s+/g, " ").trim();
        var matches;

        if (!normalized) {
            return [];
        }

        matches = normalized.match(/[^.!?]+[.!?]?/g);

        if (!matches) {
            return [normalized];
        }

        return matches
            .map(function (line) {
                return line.trim();
            })
            .filter(function (line) {
                return line.length > 0;
            });
    }

    function bulletizeProjectDetails() {
        var sections = Array.prototype.slice.call(document.querySelectorAll('section[data-slide-title^="Project"] .project-side'));

        sections.forEach(function (section) {
            if (section.getAttribute("data-bulleted") === "true") {
                return;
            }

            var headings = Array.prototype.slice.call(section.querySelectorAll("h3"));

            headings.forEach(function (heading) {
                var cursor = heading.nextElementSibling;
                var paragraphNodes = [];
                var sentences = [];
                var list;

                while (cursor && cursor.tagName === "P") {
                    paragraphNodes.push(cursor);
                    sentences = sentences.concat(toSentenceList(cursor.textContent || ""));
                    cursor = cursor.nextElementSibling;
                }

                if (!paragraphNodes.length || !sentences.length) {
                    return;
                }

                list = document.createElement("ul");
                list.className = "project-bullet-list";

                sentences.forEach(function (sentence) {
                    var item = document.createElement("li");
                    item.textContent = sentence;
                    list.appendChild(item);
                });

                section.insertBefore(list, paragraphNodes[0]);
                paragraphNodes.forEach(function (node) {
                    node.remove();
                });
            });

            section.setAttribute("data-bulleted", "true");
        });
    }

    function setActiveSlide(index) {
        activeIndex = index;
        slides.forEach(function (slide, i) {
            slide.classList.toggle("is-active", i === index);
        });

        dots.forEach(function (dot, i) {
            var active = i === index;
            dot.classList.toggle("is-active", active);
            dot.setAttribute("aria-selected", active ? "true" : "false");
            dot.setAttribute("tabindex", active ? "0" : "-1");
        });

        if (slideCounter) {
            slideCounter.textContent = String(index + 1).padStart(2, "0") + " / " + String(slides.length).padStart(2, "0");
        }
    }

    function updateProgress(progress) {
        var p = clamp(progress || 0, 0, 1);

        if (progressFill) {
            progressFill.style.transform = "scaleX(" + p + ")";
        }

        var index = Math.round(p * Math.max(slides.length - 1, 1));
        setActiveSlide(index);
    }

    function scrollToSlide(index) {
        var targetIndex = clamp(index, 0, slides.length - 1);
        if (verticalLayout) {
            window.scrollTo({
                top: slides[targetIndex].getBoundingClientRect().top + window.scrollY,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"
            });
            return;
        }

        if (!horizontalTween || !horizontalTween.scrollTrigger) {
            return;
        }

        var st = horizontalTween.scrollTrigger;
        var targetProgress = slides.length > 1 ? targetIndex / (slides.length - 1) : 0;
        var targetY = st.start + (st.end - st.start) * targetProgress;

        window.scrollTo({
            top: targetY,
            behavior: "smooth"
        });
    }

    function bindDotEvents() {
        dots.forEach(function (dot) {
            dot.addEventListener("click", function () {
                var index = Number(dot.getAttribute("data-index"));
                scrollToSlide(index);
            });
        });
    }

    function bindKeyboardEvents() {
        window.addEventListener("keydown", function (event) {
            if (!slides.length) {
                return;
            }

            if (event.target.closest("input, textarea, select, [contenteditable='true']")) {
                return;
            }

            // Keep native vertical reading keys in the continuous document.
            if (verticalLayout && event.key !== "ArrowLeft" && event.key !== "ArrowRight") {
                return;
            }

            var current = dots.findIndex(function (dot) {
                return dot.classList.contains("is-active");
            });

            if (current < 0) {
                current = 0;
            }

            // Read overflowing content before vertical keys advance the deck.
            var readingDirection = (event.key === "ArrowDown" || event.key === "PageDown") ? 1 :
                (event.key === "ArrowUp" || event.key === "PageUp") ? -1 : 0;
            var currentSlide = slides[current];
            var remaining = currentSlide.scrollHeight - currentSlide.clientHeight - currentSlide.scrollTop;
            if (readingDirection && ((readingDirection > 0 && remaining > 1) ||
                (readingDirection < 0 && currentSlide.scrollTop > 1))) {
                event.preventDefault();
                currentSlide.scrollBy({
                    top: readingDirection * (event.key.indexOf("Page") === 0 ? currentSlide.clientHeight * 0.8 : 48),
                    behavior: "auto"
                });
                return;
            }

            if (event.key === "ArrowRight" || event.key === "ArrowDown" || event.key === "PageDown") {
                event.preventDefault();
                scrollToSlide(current + 1);
            } else if (event.key === "ArrowLeft" || event.key === "ArrowUp" || event.key === "PageUp") {
                event.preventDefault();
                scrollToSlide(current - 1);
            } else if (event.key === "Home") {
                event.preventDefault();
                scrollToSlide(0);
            } else if (event.key === "End") {
                event.preventDefault();
                scrollToSlide(slides.length - 1);
            }
        });
    }

    function initGsapHorizontalScroll() {
        if (!window.gsap || !window.ScrollTrigger || !shell || !track || slides.length === 0) {
            verticalLayout = true;
            document.body.classList.add("vertical-deck");
            setActiveSlide(0);
            return;
        }

        gsap.registerPlugin(ScrollTrigger);
        ScrollTrigger.config({
            ignoreMobileResize: true
        });

        horizontalTween = gsap.to(track, {
            x: function () {
                return -(track.scrollWidth - window.innerWidth);
            },
            ease: "none",
            overwrite: "auto",
            scrollTrigger: {
                trigger: shell,
                start: "top top",
                end: function () {
                    return "+=" + Math.max(track.scrollWidth - window.innerWidth, 1);
                },
                pin: true,
                scrub: 0.42,
                anticipatePin: 1,
                fastScrollEnd: false,
                invalidateOnRefresh: true,
                snap: slides.length > 1 ? {
                    snapTo: function (value) {
                        var maxIndex = slides.length - 1;
                        var scaled = value * maxIndex;
                        var lower = Math.floor(scaled);
                        var fraction = scaled - lower;
                        var targetIndex = lower + (fraction >= 0.5 ? 1 : 0);
                        targetIndex = clamp(targetIndex, 0, maxIndex);
                        return targetIndex / maxIndex;
                    },
                    inertia: false,
                    duration: { min: 0.08, max: 0.22 },
                    delay: 0.02,
                    ease: "power3.out"
                } : false,
                onUpdate: function (self) {
                    updateProgress(self.progress);
                }
            }
        });

        ScrollTrigger.addEventListener("refreshInit", setViewportUnit);
        ScrollTrigger.addEventListener("refresh", alignTimelineHonors);
        ScrollTrigger.refresh();
    }

    function syncVerticalProgress() {
        if (!verticalLayout) {
            return;
        }

        var index = 0;
        var readingLine = window.innerHeight * 0.35;
        slides.forEach(function (slide, i) {
            if (slide.getBoundingClientRect().top <= readingLine) {
                index = i;
            }
        });
        updateProgress(index / Math.max(slides.length - 1, 1));
    }

    function scheduleVerticalProgress() {
        if (!verticalLayout || progressFramePending) {
            return;
        }
        progressFramePending = true;
        window.requestAnimationFrame(function () {
            progressFramePending = false;
            syncVerticalProgress();
        });
    }

    function setNavigationMode() {
        var index = activeIndex;

        if (horizontalTween) {
            horizontalTween.scrollTrigger.kill(true);
            horizontalTween.kill();
            horizontalTween = null;
            track.style.removeProperty("transform");
            ScrollTrigger.removeEventListener("refreshInit", setViewportUnit);
            ScrollTrigger.removeEventListener("refresh", alignTimelineHonors);
        }

        verticalLayout = mobileQuery.matches || !window.gsap || !window.ScrollTrigger;
        document.body.classList.toggle("vertical-deck", verticalLayout);

        setViewportUnit();
        alignTimelineHonors();
        if (verticalLayout) {
            window.scrollTo(0, slides[index].getBoundingClientRect().top + window.scrollY);
            syncVerticalProgress();
        } else {
            initGsapHorizontalScroll();
            if (horizontalTween) {
                var st = horizontalTween.scrollTrigger;
                window.scrollTo(0, st.start + (st.end - st.start) * index / Math.max(slides.length - 1, 1));
            }
        }
    }

    function init() {
        setViewportUnit();
        bulletizeProjectDetails();
        alignTimelineHonors();
        setActiveSlide(0);
        updateProgress(0);
        bindDotEvents();
        bindKeyboardEvents();
        window.addEventListener("scroll", scheduleVerticalProgress, { passive: true });
        mobileQuery.addEventListener("change", setNavigationMode);
        setNavigationMode();
        window.addEventListener("resize", function () {
            setViewportUnit();
            alignTimelineHonors();
            syncVerticalProgress();
        });
        window.requestAnimationFrame(alignTimelineHonors);

        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () {
                alignTimelineHonors();
                syncVerticalProgress();
            });
        }
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
