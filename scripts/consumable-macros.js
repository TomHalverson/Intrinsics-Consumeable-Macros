/**
 * Consumable Macros Module
 * Adds the ability to attach macros to consumable items
 */

const MODULE_ID = "consumable-macros";
const FLAG_MACRO_ID = "macroId";

/**
 * Initialize the module
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Consumable Macros module`);
});

/**
 * Add macro section to item sheets
 */
Hooks.on("renderItemSheet", async (app, html, data) => {
  const item = app.item;

  // Only add to consumable items
  if (item.type !== "consumable") return;

  // Get the stored macro ID
  const macroId = item.getFlag(MODULE_ID, FLAG_MACRO_ID);
  const macro = macroId ? game.macros.get(macroId) : null;

  // Find the details tab
  const detailsTab = html.find('.tab[data-tab="details"]');
  if (!detailsTab.length) return;

  // Create the macro section HTML
  const macroSection = `
    <div class="form-group consumable-macro-section">
      <label>Consumable Macro</label>
      <div class="consumable-macro-drop-zone" data-item-id="${item.id}">
        ${macro ? `
          <div class="consumable-macro-content">
            <img src="${macro.img}" alt="${macro.name}" />
            <span class="macro-name">${macro.name}</span>
            <a class="macro-remove" title="Remove Macro"><i class="fas fa-times"></i></a>
          </div>
        ` : `
          <div class="consumable-macro-placeholder">
            <i class="fas fa-code"></i>
            <p>Drag a macro here to execute when this item is used</p>
          </div>
        `}
      </div>
    </div>
  `;

  // Insert the macro section into the details tab
  // Try to find a good insertion point
  const otherTagsSection = detailsTab.find('.form-group').last();
  if (otherTagsSection.length) {
    otherTagsSection.after(macroSection);
  } else {
    detailsTab.append(macroSection);
  }

  // Add event listeners
  const dropZone = html.find(".consumable-macro-drop-zone");

  // Handle drag over
  dropZone.on("dragover", (event) => {
    event.preventDefault();
    dropZone.addClass("drag-over");
  });

  // Handle drag leave
  dropZone.on("dragleave", (event) => {
    event.preventDefault();
    dropZone.removeClass("drag-over");
  });

  // Handle drop
  dropZone.on("drop", async (event) => {
    event.preventDefault();
    dropZone.removeClass("drag-over");

    // Get the dropped data
    let data;
    try {
      data = JSON.parse(event.originalEvent.dataTransfer.getData("text/plain"));
    } catch (err) {
      return;
    }

    // Verify it's a macro
    if (data.type !== "Macro") return;

    // Get the macro
    const droppedMacro = await fromUuid(data.uuid);
    if (!droppedMacro) {
      ui.notifications.error("Could not find the dropped macro");
      return;
    }

    // Save the macro ID to the item
    await item.setFlag(MODULE_ID, FLAG_MACRO_ID, droppedMacro.id);

    ui.notifications.info(`Macro "${droppedMacro.name}" attached to ${item.name}`);

    // Re-render the sheet
    app.render();
  });

  // Handle remove button
  html.find(".macro-remove").on("click", async (event) => {
    event.preventDefault();
    await item.unsetFlag(MODULE_ID, FLAG_MACRO_ID);
    ui.notifications.info(`Macro removed from ${item.name}`);
    app.render();
  });

  // Make the drop zone clickable to view the macro
  html.find(".consumable-macro-content").on("click", (event) => {
    if ($(event.target).closest(".macro-remove").length) return;
    if (macro) {
      macro.sheet.render(true);
    }
  });
});

/**
 * Execute the macro when the item is used
 */
Hooks.on("preUpdateItem", async (item, change, options, userId) => {
  // Only process for the current user
  if (userId !== game.user.id) return;

  // Check if this is a consumable item being used
  if (item.type !== "consumable") return;

  // Check if quantity is being reduced (item being consumed)
  if (!change.system?.quantity) return;

  const oldQuantity = item.system.quantity;
  const newQuantity = change.system.quantity;

  // Only trigger if quantity is decreasing
  if (newQuantity >= oldQuantity) return;

  // Get the associated macro
  const macroId = item.getFlag(MODULE_ID, FLAG_MACRO_ID);
  if (!macroId) return;

  const macro = game.macros.get(macroId);
  if (!macro) {
    console.warn(`${MODULE_ID} | Macro ${macroId} not found for item ${item.name}`);
    return;
  }

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | Executing macro "${macro.name}" for consumed item "${item.name}"`);

    // Create a context with useful variables
    const speaker = ChatMessage.getSpeaker();
    const actor = ChatMessage.getSpeakerActor(speaker);
    const token = canvas.tokens.get(speaker.token);
    const character = game.user.character;

    // Execute the macro with context
    await macro.execute({
      actor,
      token,
      character,
      item,
      speaker
    });

  } catch (err) {
    console.error(`${MODULE_ID} | Error executing macro for ${item.name}:`, err);
    ui.notifications.error(`Failed to execute macro: ${err.message}`);
  }
});

/**
 * Alternative hook for PF2e specific item usage
 */
Hooks.on("pf2e.useItem", async (item, event, target) => {
  // Only process consumables
  if (item.type !== "consumable") return;

  // Get the associated macro
  const macroId = item.getFlag(MODULE_ID, FLAG_MACRO_ID);
  if (!macroId) return;

  const macro = game.macros.get(macroId);
  if (!macro) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | Executing macro "${macro.name}" for used item "${item.name}"`);

    const speaker = ChatMessage.getSpeaker();
    const actor = ChatMessage.getSpeakerActor(speaker);
    const token = canvas.tokens.get(speaker.token);
    const character = game.user.character;

    await macro.execute({
      actor,
      token,
      character,
      item,
      speaker,
      event,
      target
    });

  } catch (err) {
    console.error(`${MODULE_ID} | Error executing macro for ${item.name}:`, err);
    ui.notifications.error(`Failed to execute macro: ${err.message}`);
  }
});

/**
 * Hook into item consumption for PF2e
 */
Hooks.on("pf2e.consumeItem", async (item, actor) => {
  // Get the associated macro
  const macroId = item.getFlag(MODULE_ID, FLAG_MACRO_ID);
  if (!macroId) return;

  const macro = game.macros.get(macroId);
  if (!macro) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | Executing macro "${macro.name}" for consumed item "${item.name}"`);

    const speaker = ChatMessage.getSpeaker({actor});
    const token = actor.getActiveTokens()[0];
    const character = game.user.character;

    await macro.execute({
      actor,
      token,
      character,
      item,
      speaker
    });

  } catch (err) {
    console.error(`${MODULE_ID} | Error executing macro for ${item.name}:`, err);
    ui.notifications.error(`Failed to execute macro: ${err.message}`);
  }
});

console.log(`${MODULE_ID} | Consumable Macros module loaded`);
