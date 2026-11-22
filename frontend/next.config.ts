const nextConfig = {
  // The app is fully static: parquet is pre-processed into /public/data by the
  // pipeline, so there is no server-side API to deploy.
  output: "export",
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
