import { Kernel, App } from "./kernel.js";
import { apps } from "./apps.js";

let kernel = new Kernel(".screen");
let input = document.querySelector(".webos_taskbar_input") as HTMLInputElement;
let suggestion = document.querySelector(".suggestion") as HTMLDivElement;
let appList: string[] = []
for (const key in apps) {
    kernel.registerApp(apps[key] as App);
    appList.push(key)
}

input.addEventListener("keydown", (e) => {
    let match = appList.filter(word => {
        return word.toLowerCase().startsWith(input.value.toLowerCase())
    })

    if (e.key === "Enter") {
        kernel.open(input.value);
    } else if (e.key === "Tab") {
        e.preventDefault();
        input.value = match[0];
    }

    suggestion.textContent = match[0];
})

console.log("--STARTING-OS--")




