// Entry point, loaded by index.html: start the app in the mode the environment calls for.

import { actions, startApp } from './app.ts';
import { appModeFromEnv } from './config.ts';

export { actions };

/** Resolves once the page has started (the tests wait for this). */
export const ready = startApp(appModeFromEnv());
