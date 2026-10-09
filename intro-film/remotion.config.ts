import { Config } from "@remotion/cli/config";

// Clips and XP assets are build inputs, assembled by prepare.py outside git.
Config.setPublicDir("../.intro-build/film/public");
// JPEG frames (q95) keep memory and encode time down; output is H.264 anyway.
Config.setVideoImageFormat("jpeg");
Config.setJpegQuality(95);
Config.setCodec("h264");
Config.setCrf(14);
Config.setPixelFormat("yuv420p");
// This machine often runs near its memory limit; two tabs keep swap in check.
Config.setConcurrency(2);
Config.setOffthreadVideoCacheSizeInBytes(512 * 1024 * 1024);
// The machine is often busy; give large video frames time to extract.
Config.setDelayRenderTimeoutInMilliseconds(180000);
