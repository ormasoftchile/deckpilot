/**
 * Entry point — imported as <script type="module"> which is implicitly deferred.
 * By the time this runs, the DOM is ready. We call initDeckPicker() immediately
 * so the webview-to-host listener is registered before presentation.js (defer) fires.
 */
import { initDeckPicker } from './main';

void initDeckPicker();
