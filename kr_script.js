(function () {
    "use strict";

    var shell = document.getElementById("deckShell");
    var track = document.getElementById("deckTrack");
    var slides = Array.prototype.slice.call(document.querySelectorAll(".slide"));
    var dots = Array.prototype.slice.call(document.querySelectorAll(".dot"));
    var progressFill = document.getElementById("progressFill");
    var slideCounter = document.getElementById("slideCounter");
    var horizontalTween = null;

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

    function setActiveSlide(index) {
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
        if (!horizontalTween || !horizontalTween.scrollTrigger) {
            return;
        }

        var st = horizontalTween.scrollTrigger;
        var targetIndex = clamp(index, 0, slides.length - 1);
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

            var current = dots.findIndex(function (dot) {
                return dot.classList.contains("is-active");
            });

            if (current < 0) {
                current = 0;
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
            document.body.classList.add("no-gsap");
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

    function init() {
        setViewportUnit();
        alignTimelineHonors();
        setActiveSlide(0);
        updateProgress(0);
        bindDotEvents();
        bindKeyboardEvents();
        initGsapHorizontalScroll();
        window.addEventListener("resize", function () {
            setViewportUnit();
            alignTimelineHonors();
        });
        window.requestAnimationFrame(alignTimelineHonors);
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", init);
    } else {
        init();
    }
})();
