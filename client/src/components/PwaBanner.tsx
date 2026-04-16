import { useState, useEffect, useRef, useCallback } from "react";

export default function PwaBanner() {
  const [visible, setVisible] = useState(false);
  const deferredPromptRef = useRef<any>(null);

  useEffect(() => {
    const isInstalled = () => localStorage.getItem("lumen_pwa_installed") === "true";
    const isDismissed = () => localStorage.getItem("lumen_pwa_prompt_dismissed") === "true";

    const handler = (e: Event) => {
      e.preventDefault();
      deferredPromptRef.current = e;
      if (!isInstalled() && !isDismissed()) {
        setVisible(true);
      }
    };

    const installedHandler = () => {
      localStorage.setItem("lumen_pwa_installed", "true");
      setVisible(false);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("appinstalled", installedHandler);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("appinstalled", installedHandler);
    };
  }, []);

  const handleInstall = useCallback(async () => {
    const prompt = deferredPromptRef.current;
    if (!prompt) return;
    prompt.prompt();
    const result = await prompt.userChoice;
    if (result.outcome === "accepted") {
      localStorage.setItem("lumen_pwa_installed", "true");
    } else {
      localStorage.setItem("lumen_pwa_prompt_dismissed", "true");
    }
    deferredPromptRef.current = null;
    setVisible(false);
  }, []);

  const handleDismiss = useCallback(() => {
    localStorage.setItem("lumen_pwa_prompt_dismissed", "true");
    setVisible(false);
  }, []);

  if (!visible) return null;

  return (
    <div className={`pwa-banner ${visible ? "pwa-banner--visible" : ""}`}>
      <p className="pwa-banner__text">Add Lumen to your home screen for the full experience</p>
      <button className="pwa-banner__install" onClick={handleInstall}>Install</button>
      <button className="pwa-banner__dismiss" onClick={handleDismiss} aria-label="Dismiss">×</button>
    </div>
  );
}
