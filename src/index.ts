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
  { label: "1 - No user/business value", value: 1 },
  { label: "2 - Very low impact or confidence", value: 2 },
  { label: "3 - Low impact & confidence", value: 3 },
  { label: "5 - Moderate impact, moderate confidence", value: 5 },
  { label: "8 - High impact & confidence", value: 8 },
  { label: "13 - Very high impact & confidence", value: 13 },
  { label: "21 - Highest impact & confidence", value: 21 },
];

const TIME_CRITICALITY_LABELS = [
  { label: "1 - Not critical at all", value: 1 },
  { label: "2 - Can wait till next review", value: 2 },
  { label: "3 - Can wait for 4 sprints", value: 3 },
  { label: "5 - Moderate urgency (3 sprints)", value: 5 },
  { label: "8 - Quite urgent (2 sprints)", value: 8 },
  { label: "13 - Needs next sprint", value: 13 },
  { label: "21 - Must be next up", value: 21 },
];

const RISK_REDUCTION_LABELS = [
  { label: "1 - No risk reduction", value: 1 },
  { label: "2 - Reduces very minor risk", value: 2 },
  { label: "3 - Reduces low probability/severity risk", value: 3 },
  { label: "5 - Moderate risk reduction", value: 5 },
  { label: "8 - High risk reduction", value: 8 },
  { label: "13 - Removes very high risk", value: 13 },
  { label: "21 - Prevents disaster or enables huge opportunity", value: 21 },
];

const JOB_SIZE_LABELS = [
  { label: "1 - Trivial/smallest chunk", value: 1 },
  { label: "2 - A day or less", value: 2 },
  { label: "3 - A quarter of a sprint", value: 3 },
  { label: "5 - Half a sprint", value: 5 },
  { label: "8 - One sprint", value: 8 },
  { label: "13 - One to two sprints", value: 13 },
  { label: "21 - Two sprints or more (should be split)", value: 21 },
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

async function showWSJFFormForBlock(uuid: string) {
  // Select the target block
  await logseq.Editor.selectBlock(uuid);
  // Open form (uses whatever block is selected)
  await showWSJFForm();
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
      if (wsjfScore >= 10) backgroundColor = "red";
      else if (wsjfScore >= 4) backgroundColor = "green";
      else if (wsjfScore >= 1.5) backgroundColor = "blue";
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
      //logseq.UI.showMsg("Task prioritized!", "success");
      setTimeout(() => updateBlockWSJF(currentBlock.uuid), 500);
    });
    cancelBtn?.addEventListener("click", () => {
      logseq.provideUI({ key: "wsjf-form-modal", template: "" });
    });
  }, 100);
}

//Migration function
const MIGRATION_EMOJI = "➡️";
const MAX_MIGRATIONS = 3;

async function migrateTask(uuid: string) {
  try {
    const block = await logseq.Editor.getBlock(uuid, {
      includeChildren: false,
    });
    if (!block?.content) return;

    // Count existing migration emojis
    const migrationCount = (
      block.content.match(new RegExp(MIGRATION_EMOJI, "g")) || []
    ).length;

    if (migrationCount >= MAX_MIGRATIONS) {
      logseq.UI.showMsg(
        "⚠️ Task already migrated 3 times! Consider breaking it down or removing it.",
        "warning",
      );
      return;
    }

    // Match task markers: TODO, LATER, NOW, DOING, DONE, WAITING, CANCELED, CANCELLED, IN-PROGRESS, etc.
    const taskMarkerRegex =
      /^(TODO|LATER|NOW|DOING|DONE|WAITING|CANCELED|CANCELLED|IN-PROGRESS)\s+/i;
    const match = block.content.match(taskMarkerRegex);

    let newContent: string;
    if (match) {
      // Insert emoji after the task marker
      const marker = match[0]; // e.g., "TODO "
      const rest = block.content.slice(marker.length);
      newContent = marker + MIGRATION_EMOJI + " " + rest;
    } else {
      // No task marker, add emoji at the beginning
      newContent = MIGRATION_EMOJI + " " + block.content;
    }

    await logseq.Editor.updateBlock(uuid, newContent);

    const remaining = MAX_MIGRATIONS - migrationCount - 1;
    if (remaining > 0) {
      logseq.UI.showMsg(
        `✅ Task migrated (${remaining} migration${remaining > 1 ? "s" : ""} remaining)`,
        "success",
      );
    } else {
      logseq.UI.showMsg("✅ Task migrated (final migration)", "warning");
    }
  } catch (error) {
    console.error("Error migrating task:", error);
    logseq.UI.showMsg("Error migrating task", "error");
  }
}

// Main registration
function main() {
  logseq.Editor.registerSlashCommand("WSJF: Prioritize", showWSJFForm);
  logseq.Editor.registerSlashCommand("Calculate WSJF", async () => {
    await updatePageWSJF();
  });
  logseq.Editor.registerBlockContextMenuItem(
    "Prioritisation for this block",
    async (e) => {
      await showWSJFFormForBlock(e.uuid);
    },
  );
  logseq.Editor.registerBlockContextMenuItem("Mark as Migrated", async (e) => {
    await migrateTask(e.uuid);
  });
  logseq.App.registerUIItem("toolbar", {
    key: "wsjf-calculator",
    template: `<a class="button" data-on-click="calculateWSJF" title="Calculate WSJF for current page"><i class="ti ti-calculator"></i></a>`,
  });
  logseq.provideModel({
    calculateWSJF: async () => {
      await updatePageWSJF();
    },
  });
  // logseq.DB.onChanged(async (e) => {
  //   if (!e.blocks?.length) return;
  //   for (const block of e.blocks) {
  //     if (block.properties) {
  //       const props = block.properties;
  //       const hasWSJFProps =
  //         getPropertyValue(props, "businessValue") !== undefined ||
  //         getPropertyValue(props, "timeCriticality") !== undefined ||
  //         getPropertyValue(props, "riskReduction") !== undefined ||
  //         getPropertyValue(props, "jobSize") !== undefined;
  //       if (hasWSJFProps)
  //         setTimeout(() => {
  //           updateBlockWSJF(block.uuid);
  //         }, 300);
  //     }
  //   }
  // });
  //logseq.UI.showMsg("WSJF Priority Calculator ready!", "success");
}

logseq.ready(main).catch(console.error);
