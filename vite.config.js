import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
export default defineConfig({
    base: "/Yubai-Mvp-vedio/",
    plugins: [react()],
    server: {
        host: "127.0.0.1",
        port: 4173,
        allowedHosts: [".trycloudflare.com"],
    },
});
