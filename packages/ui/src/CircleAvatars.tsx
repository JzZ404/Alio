/**
 * Overlapping avatar cluster for the Care Circle header — reads as a group
 * rather than a single face. Caps at three faces so the cluster stays
 * legible even when the circle has more members than that.
 *
 * Each image is decorative: the header's name/subtitle text already
 * identifies the circle, so these carry `role="presentation"` and `alt=""`
 * rather than announcing redundant names to assistive tech.
 */
export function CircleAvatars({ srcs }: { srcs: string[] }) {
  const shown = srcs.slice(0, 3);
  if (shown.length === 0) return null;

  return (
    <span className="relative flex size-[52px] shrink-0 items-center">
      {shown[0] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown[0]}
          alt=""
          role="presentation"
          className="absolute left-0 top-0 size-[34px] rounded-full border-2 border-white object-cover"
        />
      )}
      {shown[1] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown[1]}
          alt=""
          role="presentation"
          className="absolute bottom-0 right-0 size-[28px] rounded-full border-2 border-white object-cover"
        />
      )}
      {shown[2] && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={shown[2]}
          alt=""
          role="presentation"
          className="absolute bottom-[2px] left-[6px] size-[20px] rounded-full border-2 border-white object-cover"
        />
      )}
    </span>
  );
}
