import { useEffect, useRef } from "react";

/**
 * Scroll-reveal hook: adds `.in` class to elements with `.up` when they
 * enter the viewport, matching the original HTML behaviour.
 *
 * A MutationObserver watches for new `.up` elements added after the initial
 * render (e.g. after auth loads) and observes them automatically.
 */
export function useScrollReveal() {
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => {
    if (!("IntersectionObserver" in window)) {
      document.querySelectorAll(".up").forEach((el) => el.classList.add("in"));
      return;
    }

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("in");
            observerRef.current?.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: "0px 0px -28px 0px" }
    );

    const observe = (el: Element) => {
      if (!el.classList.contains("in")) {
        observerRef.current!.observe(el);
      }
    };

    document.querySelectorAll(".up").forEach(observe);

    // Watch for new `.up` elements added to the DOM (e.g. after auth resolves)
    const mutation = new MutationObserver((mutations) => {
      for (const m of mutations) {
        for (const node of m.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          if (node.classList.contains("up")) observe(node);
          node.querySelectorAll(".up").forEach(observe);
        }
      }
    });
    mutation.observe(document.body, { childList: true, subtree: true });

    // Hero elements fire on first paint
    requestAnimationFrame(() => {
      setTimeout(() => {
        document.querySelectorAll(".hero .up").forEach((el) => el.classList.add("in"));
      }, 80);
    });

    return () => {
      observerRef.current?.disconnect();
      mutation.disconnect();
    };
  }, []);
}
