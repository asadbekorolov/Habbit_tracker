import { getFrameStyle } from "../utils/cosmetics";

interface AvatarFrameProps {
  frameId?: string | null;
  children: React.ReactNode;
  className?: string;
  radius?: number;
}

// Do'kondan sotib olingan ramkani avatar atrofida ko'rsatadi — ramka
// bo'lmasa, bolalar elementi o'zgarishsiz qaytadi.
export function AvatarFrame({ frameId, children, className, radius = 9999 }: AvatarFrameProps) {
  const style = getFrameStyle(frameId);
  if (!style) return <>{children}</>;
  return (
    <div
      className={className}
      style={{
        display: "inline-flex",
        borderRadius: radius,
        border: style.border,
        boxShadow: style.boxShadow,
      }}
    >
      {children}
    </div>
  );
}
