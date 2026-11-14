"use client";
import Image from "next/image";
import { useState } from "react";
import { User } from "lucide-react";

interface AvatarProps {
  name: string;
  role?: string;
  src?: string;
  size?: number;
  className?: string;
}

const AVATAR_MAP: Record<string, string> = {
  aditi: "/avatars/avatar_aditi.jpg",
  leaver: "/avatars/avatar_aditi.jpg",
  karan: "/avatars/avatar_karan.jpg",
  contributor: "/avatars/avatar_karan.jpg",
  successor: "/avatars/avatar_karan.jpg",
  lead: "/avatars/avatar_lead.jpg",
  reviewer: "/avatars/avatar_lead.jpg",
};

export function UserAvatar({ name, role, src, size = 36, className = "" }: AvatarProps) {
  const [error, setError] = useState(false);
  const key = (role || name).toLowerCase();
  const imageSrc = src || AVATAR_MAP[key] || "/avatars/avatar_lead.jpg";
  const roundedCls = className.includes("rounded-") ? "" : "rounded-full";

  return (
    <div
      className={`relative inline-flex shrink-0 items-center justify-center overflow-hidden border border-zinc-200 bg-zinc-100 ${roundedCls} ${className}`}
      style={{ width: size, height: size }}
    >
      {!error ? (
        <Image
          src={imageSrc}
          alt={name}
          width={size}
          height={size}
          className="h-full w-full object-cover"
          onError={() => setError(true)}
        />
      ) : (
        <span className="flex h-full w-full items-center justify-center bg-zinc-200 text-xs font-bold text-zinc-700">
          {name ? name.slice(0, 2).toUpperCase() : <User size={size * 0.5} />}
        </span>
      )}
    </div>
  );
}
