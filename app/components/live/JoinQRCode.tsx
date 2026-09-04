"use client";
import { useEffect, useRef } from "react";
export function JoinQRCode({ code }: { code: string }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    let cancelled = false;
    // Generate locally; join codes never go to a third-party QR image service.
    import("qrcode")
      .then((qr) => {
        if (!cancelled && canvas.current)
          void qr
            .toCanvas(
              canvas.current,
              `${window.location.origin}/live/${code}`,
              { width: 72, margin: 1, errorCorrectionLevel: "M" },
            )
            .catch(() => {});
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [code]);
  return (
    <canvas
      ref={canvas}
      role="img"
      aria-label="Scan to join / 掃碼加入"
      className="h-[72px] w-[72px] shrink-0 rounded bg-white"
    />
  );
}
