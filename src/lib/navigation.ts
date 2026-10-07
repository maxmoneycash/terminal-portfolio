import { useSyncExternalStore } from "react";
import { appCatalog, type AppId } from "../xp/types";

export type Route = { app: AppId; view?: string; project?: string; video?: string; site?: string };
const remembered = new Map<AppId, Route>();
const eventName = "maxxp:navigate";

export function readRoute(): Route {
  const params = new URLSearchParams(window.location.hash.slice(1));
  const app = params.get("app") ?? "projects";
  return {
    app: Object.hasOwn(appCatalog, app) ? app as AppId : "projects",
    ...Object.fromEntries(["view", "project", "video", "site"].flatMap(key => {
      const value = params.get(key);
      return value && value.length < 160 ? [[key, value]] : [];
    })),
  };
}

export function routeHash(route: Route) {
  return `#${new URLSearchParams(Object.entries(route).filter((entry): entry is [string, string] => Boolean(entry[1]))).toString()}`;
}

export function navigate(route: Route, replace = false) {
  remembered.set(readRoute().app, readRoute());
  remembered.set(route.app, route);
  const hash = routeHash(route);
  if (window.location.hash === hash) return;
  window.history[replace ? "replaceState" : "pushState"](null, "", hash);
  window.dispatchEvent(new Event(eventName));
}

export function navigateApp(app: AppId) {
  if (readRoute().app !== app) navigate(remembered.get(app) ?? { app });
}

function subscribe(callback: () => void) {
  window.addEventListener("popstate", callback);
  window.addEventListener("hashchange", callback);
  window.addEventListener(eventName, callback);
  return () => {
    window.removeEventListener("popstate", callback);
    window.removeEventListener("hashchange", callback);
    window.removeEventListener(eventName, callback);
  };
}

export function useRoute() {
  useSyncExternalStore(subscribe, () => window.location.hash, () => "");
  return readRoute();
}
