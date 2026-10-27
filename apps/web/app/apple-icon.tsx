import { ImageResponse } from 'next/og';

// Icon khi "Thêm vào Màn hình chính" trên iOS (iOS không dùng favicon SVG). Cùng hình với app/icon.svg,
// nhưng nền phủ kín, không bo góc: iOS tự bo.
export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

const glyph = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"/><path d="M2 6h4"/><path d="M2 10h4"/><path d="M2 14h4"/><path d="M2 18h4"/><path d="M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"/></svg>`;

export default function AppleIcon() {
  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: '#4842d0',
      }}
    >
      <img
        width={104}
        height={104}
        src={`data:image/svg+xml,${encodeURIComponent(glyph)}`}
        alt=""
      />
    </div>,
    size,
  );
}
