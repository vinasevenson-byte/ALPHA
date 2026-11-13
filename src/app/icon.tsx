import { ImageResponse } from "next/og";

export const size = {
  width: 512,
  height: 512,
};

export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 112,
          background: "linear-gradient(135deg, #6C5CE7 0%, #4834D4 100%)",
          color: "#FFFFFF",
          fontSize: 280,
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
