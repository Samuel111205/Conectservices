export default function Image({ fill, priority, unoptimized, ...properties }) {
  const style = fill
    ? {
        position: "absolute",
        width: "100%",
        height: "100%",
        inset: 0,
        objectFit: properties.style?.objectFit || "cover",
        ...properties.style,
      }
    : properties.style;
  return (
    <img
      {...properties}
      style={style}
      loading={priority ? "eager" : "lazy"}
      decoding="async"
    />
  );
}
