import "./style.css";
import { Eva, EventKind } from "@eva-ics/webengine";

const eva = new Eva();

const params = new URLSearchParams(window.location.search);

enum ButtonKind {
  Toggle = "toggle",
  Value = "value",
  Run = "run"
}

interface Config {
  button: Array<ButtonConfig> | ButtonConfig;
}

interface ButtonConfig {
  oid?: string;
  label?: string;
  kind?: ButtonKind;
  busy?: string;
  input_width?: number;
}

function init_colors(params: URLSearchParams) {
  const bg = params.get("bg");
  const fg = params.get("fg");
  if (bg) {
    let sheet = document.createElement("style");
    sheet.innerHTML = `body { background-color: ${bg}; }`;
    document.head.appendChild(sheet);
  }
  if (fg) {
    let sheet = document.createElement("style");
    sheet.innerHTML = `body { color: ${fg}; }`;
    document.head.appendChild(sheet);
  }
}

async function run_lmacro(oid: string) {
  await eva.action.run(oid, {}, true);
}

async function run_action_toggle(oid: string) {
  await eva.action.toggle(oid, true);
}

async function run_action_value(oid: string, input: HTMLInputElement) {
  let val: string | number = parseFloat(input.value);
  if (isNaN(val)) {
    val = input.value;
  }
  await eva.action.exec(oid, { value: val }, true);
}

async function start(params: URLSearchParams) {
  eva.on(EventKind.LoginFailed, (err: any) => {
    draw_error(err);
  });
  try {
    const ck = params.get("ck");
    const ehmi_config = await eva.call("ehmi.get_config", { ck: ck }, {});
    init_dashboard(ehmi_config.config);
    eva.api_token = ehmi_config.token;
    eva.set_auth_cookies = false;
    eva.start();
  } catch (err) {
    draw_error(err);
  }
}

function draw_error(err: any) {
  let e = document.createElement("div");
  e.className = "fatal";
  let app = document.getElementById("app");
  let msg;
  if (err.message) {
    msg = err.message;
  } else {
    msg = err.toString();
  }
  app!.innerHTML = "";
  e.innerHTML = msg;
  app!.append(e);
}

function init_dashboard(config: Config) {
  let app: HTMLDivElement = document.getElementById("app") as HTMLDivElement;
  let state_updates: Array<string> = [];

  const format_action = (action: ButtonConfig) => {
    if (!action.oid) {
      throw new Error("action OID not specified");
    }
    let entry = document.createElement("div");
    let label = document.createElement("div");
    label.className = "btn_label";
    entry.className = "entry";
    app.appendChild(entry);
    let kind = action.kind;
    let button: HTMLButtonElement | HTMLInputElement;
    let button2: HTMLButtonElement | null = null;
    if (action.oid.startsWith("lmacro:")) {
      kind = ButtonKind.Run;
    } else {
      entry.style.display = "none";
      if (!kind) {
        kind = ButtonKind.Toggle;
      }
    }
    switch (kind) {
      case ButtonKind.Run:
        button = document.createElement("button");
        button.className = "run";
        button.addEventListener("click", () => {
          run_lmacro(action.oid as string);
        });
        button.innerHTML = "Run";
        entry.appendChild(button);
        break;
      case ButtonKind.Value:
        button = document.createElement("input");
        button.type = "text";
        button.className = "text_input";
        button.size = action.input_width || 4;
        entry.appendChild(button);
        button2 = document.createElement("button");
        button2.className = "apply";
        button.addEventListener("change", () => {
          button.className = "text_input changed";
        });
        button2.addEventListener("click", () => {
          button.disabled = true;
          (button2 as HTMLButtonElement).disabled = true;
          run_action_value(action.oid as string, button as HTMLInputElement);
          button.className = "text_input";
        });
        button2.innerHTML = "Apply";
        break;
      case ButtonKind.Toggle:
        label.className = "btn_label btn_label_slider";
        button = document.createElement("input");
        button.type = "checkbox";
        button.className = "slider";
        let slider = document.createElement("span");
        slider.className = "slider round";
        let btn_label = document.createElement("label");
        btn_label.className = "switch";
        btn_label.appendChild(button);
        btn_label.appendChild(slider);
        entry.appendChild(btn_label);
        button.addEventListener("change", function (event) {
          this.checked = !this.checked;
          button.disabled = true;
          run_action_toggle(action.oid as string);
          event.preventDefault();
          event.stopPropagation();
        });
    }
    if (!action.oid.startsWith("lmacro:")) {
      state_updates.push(action.oid);
      eva.watch(
        action.oid,
        (state: any) => {
          entry.style.display = "block";
          button.disabled = state.act > 0;
          if (button2) {
            button2.disabled = state.act > 0;
          }
          switch (kind) {
            case ButtonKind.Toggle:
              (button as HTMLInputElement).checked = state.value === 1;
              break;
            case ButtonKind.Value:
              button.value = state.value;
          }
        },
        false
      );
    }
    if (action.busy) {
      state_updates.push(action.busy);
      eva.watch(
        action.busy,
        (state: any) => {
          entry.style.display = "block";
          if ((action.busy as string).startsWith("sensor:")) {
            button.disabled = state.value == 1;
            if (button2) {
              button2.disabled = state.value == 1;
            }
          } else if ((action.busy as string).startsWith("lvar:")) {
            button.disabled = state.status == 1;
            if (button2) {
              button2.disabled = state.status == 1;
            }
          } else {
            button.disabled = state.act > 0;
            if (button2) {
              button2.disabled = state.act > 0;
            }
          }
        },
        false
      );
    }
    let label_text;
    if (action.label) {
      label_text = action.label.replaceAll("_", " ");
    } else {
      label_text = action.oid;
    }
    label.innerHTML = label_text;
    entry.appendChild(label);
    if (button2 !== null) {
      entry.appendChild(button2);
    }
  };

  if (config.button) {
    if (Array.isArray(config.button)) {
      for (const action of config.button as Array<ButtonConfig>) {
        format_action(action);
      }
    } else {
      format_action(config.button as ButtonConfig);
    }
  }

  eva.state_updates = state_updates;
}

init_colors(params);
start(params);
