import assert from "node:assert/strict";
import { icon } from "../functions/utils/icon.js";
import { progressBarEmojis } from "./progressbar.js";

const e = (name: keyof typeof icon) => icon[name].toString();
const bar = progressBarEmojis(50, 100, 10);
assert.ok(bar?.startsWith(e("progress_start_full")));
assert.ok(bar?.includes(e("progress_mid_full")));
assert.ok(bar?.includes(e("progress_mid_empty")));
assert.ok(bar?.endsWith(e("progress_end_empty")));
assert.ok(progressBarEmojis(100, 100, 10)?.endsWith(e("progress_end_full")));
assert.ok(progressBarEmojis(0, 100, 10)?.startsWith(e("progress_start_empty")));
console.log("progressBarEmojis: ok");
