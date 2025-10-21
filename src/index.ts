import "@logseq/libs";

// Properly hidden dot-properties for factors (AwesomeProps hides them)
const PROPERTY_MAPPINGS = {
  businessValue: [".bv", "bv", ".business-value", "business-value"],
  timeCriticality: [".tc", "tc", ".time-criticality", "time-criticality"],
  riskReduction: [".rr", "rr", ".risk-reduction", "risk-reduction"],
  jobSize: [".js", "js", ".job-size", "job-size"],
  wsjf: ["WSJF", "wsjf", "priority"],
};

// Descriptive dropdowns for work task prioritisation
const BUSINESS_VALUE_LABELS = [
  { label: "Minor impact", value: 1 },
  { label: "Noticeable benefit", value: 3 },
  { label: "Major value", value: 5 },
  { label: "Business game-changer", value: 8 },
];
const TIME_CRITICALITY_LABELS = [
  { label: "No rush", value: 1 },
  { label: "Should be done soon", value: 3 },
  { label: "Deadline approaching", value: 5 },
  { label: "Urgent/must do now", value: 8 },
];
const RISK_REDUCTION_LABELS = [
  { label: "Little/No risk/opportunity", value: 1 },
  { label: "Helps/mitigates some risk", value: 3 },
  { label: "Mitigates key risk or opens new value", value: 5 },
  { label: "Removes critical risk / enables opportunity", value: 8 },
];
const JOB_SIZE_LABELS = [
  { label: "S - Minimal effort", value: 1 },
  { label: "M - Manageable / a few hours", value: 3 },
  { label: "L - Medium / a day or two", value: 5 },
  { label: "XL - Big / a week+", value: 8 },
];

function createDropdownOptions(
  list: { label: string; value: number }[],
  selected?: number,
) {
  return list
    .map(
      (opt) =>
        `<option value="${opt.value}" ${selected === opt.value ? "selected" : ""}>${opt.label}</option>`,
    )
    .join("");
}

interface WSJFProperties {
  businessValue?: number;
  timeCriticality?: number;
  riskReduction?: number;
  jobSize?: number;
  wsjf?: number;
}

function getPropertyValue(
  properties: any,
  propertyType: keyof typeof PROPERTY_MAPPINGS,
): number | undefined {
  const possibleNames = PROPERTY_MAPPINGS[propertyType];
  for (const name of possibleNames) {
    const value = properties[name];
    if (value !== undefined && value !== null && value !== "") {
      const numValue =
        typeof value === "string" ? parseFloat(value) : Number(value);
      if (!isNaN(numValue)) return numValue;
    }
  }
  return undefined;
}

function calculateWSJF(props: WSJFProperties): number | null {
  const { businessValue, timeCriticality, riskReduction, jobSize } = props;
  if (
    businessValue === undefined ||
    timeCriticality === undefined ||
    riskReduction === undefined ||
    jobSize === undefined
  )
    return null;
  if (jobSize === 0) return null;
  const costOfDelay = businessValue + timeCriticality + riskReduction;
  return Math.round((costOfDelay / jobSize) * 100) / 100;
}

function extractWSJFProperties(properties: any): WSJFProperties {
  return {
    businessValue: getPropertyValue(properties, "businessValue"),
    timeCriticality: getPropertyValue(properties, "timeCriticality"),
    riskReduction: getPropertyValue(properties, "riskReduction"),
    jobSize: getPropertyValue(properties, "jobSize"),
  };
}

// Map wsjfScore (max 24) to Logseq color-level
function getWSJFColorClass(wsjfScore: number): string {
  // 8+8+8 maximal numerator, 1 minimal denominator
  const maxScore = 24;
  const percent = Math.round((wsjfScore / maxScore) * 100);
  if (percent >= 90) return "level-2"; // Red/pink
  if (percent >= 75) return "level-1"; // Yellow
  if (percent >= 60) return "level-4"; // Green
  if (percent >= 40) return "level-5"; // Blue
  if (percent >= 20) return "level-6"; // Purple
  return ""; // No color
}

// --- MAIN FUNCTION for block updates
async function updateBlockWSJF(uuid: string) {
  try {
    const block = await logseq.Editor.getBlock(uuid, {
      includeChildren: false,
    });
    if (!block?.properties) return;
    const wsjfProps = extractWSJFProperties(block.properties);
    const wsjfScore = calculateWSJF(wsjfProps);
    const hasLowercase = block.properties["wsjf"] !== undefined;

    let backgroundColor = "";
    if (wsjfScore !== null) {
      const percent = Math.round((wsjfScore / 24) * 100);
      if (percent >= 75) backgroundColor = "red";
      else if (percent >= 50) backgroundColor = "green";
      else if (percent >= 25) backgroundColor = "blue";
      else backgroundColor = "";

      // Official block color property!
      if (backgroundColor) {
        await logseq.Editor.upsertBlockProperty(
          uuid,
          "background-color",
          backgroundColor,
        );
      } else {
        await logseq.Editor.removeBlockProperty(uuid, "background-color");
      }

      if (hasLowercase) {
        await logseq.Editor.removeBlockProperty(uuid, "wsjf");
      }
      const currentUpper = block.properties["WSJF"];
      if (currentUpper !== wsjfScore) {
        await logseq.Editor.upsertBlockProperty(uuid, "WSJF", wsjfScore);
      }
    } else {
      if (block.properties["WSJF"] !== undefined) {
        await logseq.Editor.removeBlockProperty(uuid, "WSJF");
      }
      if (hasLowercase) {
        await logseq.Editor.removeBlockProperty(uuid, "wsjf");
      }
      await logseq.Editor.removeBlockProperty(uuid, "background-color");
    }
  } catch (error) {
    console.error("Error updating WSJF:", error);
  }
}

async function updatePageWSJF() {
  try {
    const page = await logseq.Editor.getCurrentPage();
    if (!page) {
      logseq.UI.showMsg("No page is currently open", "warning");
      return;
    }
    const pageName =
      (page as any).originalName || (page as any).name || page["name"];
    if (!pageName) {
      logseq.UI.showMsg("Could not get page name", "error");
      return;
    }
    const blocks = await logseq.Editor.getPageBlocksTree(pageName);
    let updatedCount = 0;
    async function processBlock(block: any): Promise<void> {
      if (block.properties) {
        const wsjfProps = extractWSJFProperties(block.properties);
        const wsjfScore = calculateWSJF(wsjfProps);
        if (wsjfScore !== null) {
          const currentUpper = block.properties["WSJF"];
          if (currentUpper !== wsjfScore) {
            await logseq.Editor.upsertBlockProperty(
              block.uuid,
              "WSJF",
              wsjfScore,
            );
            updatedCount++;
          }
          const colorClass = getWSJFColorClass(wsjfScore);
          if (colorClass)
            await logseq.Editor.upsertBlockProperty(
              block.uuid,
              ".color",
              colorClass,
            );
          else await logseq.Editor.removeBlockProperty(block.uuid, ".color");
        }
      }
      if (block.children && block.children.length > 0) {
        for (const child of block.children) {
          await processBlock(child);
        }
      }
    }
    for (const block of blocks) {
      await processBlock(block);
    }
    logseq.UI.showMsg(
      `WSJF calculation complete: ${updatedCount} blocks updated`,
      "success",
    );
  } catch (error) {
    console.error("Error updating page WSJF:", error);
    logseq.UI.showMsg("Error calculating WSJF", "error");
  }
}

// --- Modal Form with descriptive labels
async function showWSJFForm() {
  const currentBlock = await logseq.Editor.getCurrentBlock();
  if (!currentBlock) {
    logseq.UI.showMsg("Please place cursor in a block first", "warning");
    return;
  }

  const existing = currentBlock.properties
    ? extractWSJFProperties(currentBlock.properties)
    : {};
  const html = `
    <div id="wsjf-form" style="padding: 20px; background: var(--ls-primary-background-color); border-radius: 8px; max-width: 400px;">
      <h3 style="margin-top: 0; color: var(--ls-primary-text-color);">🎯 Prioritize</h3>
      <p style="font-size: 12px; color: var(--ls-secondary-text-color); margin-bottom: 20px;">
        Score each factor for this work task.
      </p>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: var(--ls-primary-text-color); font-weight: 600;">
          💰 Business Value:
        </label>
        <select id="wsjf-bv" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--ls-border-color); background: var(--ls-secondary-background-color); color: var(--ls-primary-text-color);">
          <option value="">Select...</option>
          ${createDropdownOptions(BUSINESS_VALUE_LABELS, existing.businessValue)}
        </select>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: var(--ls-primary-text-color); font-weight: 600;">
          ⏰ Time Criticality:
        </label>
        <select id="wsjf-tc" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--ls-border-color); background: var(--ls-secondary-background-color); color: var(--ls-primary-text-color);">
          <option value="">Select...</option>
          ${createDropdownOptions(TIME_CRITICALITY_LABELS, existing.timeCriticality)}
        </select>
      </div>
      <div style="margin-bottom: 15px;">
        <label style="display: block; margin-bottom: 5px; color: var(--ls-primary-text-color); font-weight: 600;">
          🛡️ Risk Reduction / Opportunity:
        </label>
        <select id="wsjf-rr" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--ls-border-color); background: var(--ls-secondary-background-color); color: var(--ls-primary-text-color);">
          <option value="">Select...</option>
          ${createDropdownOptions(RISK_REDUCTION_LABELS, existing.riskReduction)}
        </select>
      </div>
      <div style="margin-bottom: 20px;">
        <label style="display: block; margin-bottom: 5px; color: var(--ls-primary-text-color); font-weight: 600;">
          📏 Work Size:
        </label>
        <select id="wsjf-js" style="width: 100%; padding: 8px; border-radius: 4px; border: 1px solid var(--ls-border-color); background: var(--ls-secondary-background-color); color: var(--ls-primary-text-color);">
          <option value="">Select...</option>
          ${createDropdownOptions(JOB_SIZE_LABELS, existing.jobSize)}
        </select>
      </div>
      <div style="display: flex; gap: 10px;">
        <button id="wsjf-submit" style="flex: 1; padding: 10px; background: #3b82f6; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: 600;">
          Apply
        </button>
        <button id="wsjf-cancel" style="flex: 1; padding: 10px; background: var(--ls-secondary-background-color); color: var(--ls-primary-text-color); border: 1px solid var(--ls-border-color); border-radius: 4px; cursor: pointer;">
          Cancel
        </button>
      </div>
    </div>
  `;
  logseq.provideUI({
    key: "wsjf-form-modal",
    template: html,
    style: {
      position: "fixed",
      top: "50%",
      left: "50%",
      transform: "translate(-50%, -50%)",
      zIndex: 999,
      boxShadow: "0 4px 20px rgba(0,0,0,0.3)",
    },
  });

  setTimeout(() => {
    const submitBtn = parent.document.getElementById("wsjf-submit");
    const cancelBtn = parent.document.getElementById("wsjf-cancel");
    submitBtn?.addEventListener("click", async () => {
      const bv = parseInt(
        (parent.document.getElementById("wsjf-bv") as HTMLSelectElement)
          ?.value || "0",
      );
      const tc = parseInt(
        (parent.document.getElementById("wsjf-tc") as HTMLSelectElement)
          ?.value || "0",
      );
      const rr = parseInt(
        (parent.document.getElementById("wsjf-rr") as HTMLSelectElement)
          ?.value || "0",
      );
      const js = parseInt(
        (parent.document.getElementById("wsjf-js") as HTMLSelectElement)
          ?.value || "0",
      );
      if (!bv || !tc || !rr || !js) {
        logseq.UI.showMsg("Please fill all fields", "warning");
        return;
      }
      // Use dot-prefixed properties (hidden by AwesomeProps)
      await logseq.Editor.upsertBlockProperty(currentBlock.uuid, ".bv", bv);
      await logseq.Editor.upsertBlockProperty(currentBlock.uuid, ".tc", tc);
      await logseq.Editor.upsertBlockProperty(currentBlock.uuid, ".rr", rr);
      await logseq.Editor.upsertBlockProperty(currentBlock.uuid, ".js", js);
      logseq.provideUI({ key: "wsjf-form-modal", template: "" });
      logseq.UI.showMsg("Task prioritized!", "success");
      setTimeout(() => updateBlockWSJF(currentBlock.uuid), 500);
    });
    cancelBtn?.addEventListener("click", () => {
      logseq.provideUI({ key: "wsjf-form-modal", template: "" });
    });
  }, 100);
}

// Main registration
function main() {
  logseq.Editor.registerSlashCommand("WSJF: Prioritize", showWSJFForm);
  logseq.Editor.registerSlashCommand("Calculate WSJF", async () => {
    await updatePageWSJF();
  });
  logseq.Editor.registerBlockContextMenuItem(
    "Calculate WSJF for this block",
    async (e) => {
      await updateBlockWSJF(e.uuid);
      logseq.UI.showMsg("WSJF calculated", "success");
    },
  );
  logseq.App.registerUIItem("toolbar", {
    key: "wsjf-calculator",
    template: `<a class="button" data-on-click="calculateWSJF" title="Calculate WSJF for current page"><i class="ti ti-calculator"></i></a>`,
  });
  logseq.provideModel({
    calculateWSJF: async () => {
      await updatePageWSJF();
    },
  });
  logseq.DB.onChanged(async (e) => {
    if (!e.blocks?.length) return;
    for (const block of e.blocks) {
      if (block.properties) {
        const props = block.properties;
        const hasWSJFProps =
          getPropertyValue(props, "businessValue") !== undefined ||
          getPropertyValue(props, "timeCriticality") !== undefined ||
          getPropertyValue(props, "riskReduction") !== undefined ||
          getPropertyValue(props, "jobSize") !== undefined;
        if (hasWSJFProps)
          setTimeout(() => {
            updateBlockWSJF(block.uuid);
          }, 300);
      }
    }
  });
  logseq.UI.showMsg("WSJF Priority Calculator ready!", "success");
}

logseq.ready(main).catch(console.error);
