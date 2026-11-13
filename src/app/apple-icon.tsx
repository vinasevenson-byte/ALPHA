import { ImageResponse } from "next/og";

export const size = {
  width: 180,
  height: 180,
};

export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(135deg, #6C5CE7 0%, #4834D4 100%)",
          color: "#FFFFFF",
          fontSize: 104,
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        N
      </div>
    ),
    { ...size }
  );
}
