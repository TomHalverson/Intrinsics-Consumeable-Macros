/**
 * Consumable Macros Module
 * Adds the ability to attach macros to consumable items
 */

const MODULE_ID = "consumable-macros";
const FLAG_MACRO_UUID = "macroUuid"; // Changed to store UUID instead of just ID

// Track recently executed macros to prevent duplicates
const recentlyExecuted = new Set();

/**
 * Helper function to prevent duplicate macro execution
 */
function shouldExecuteMacro(itemName, macroUuid) {
  const key = `${itemName}:${macroUuid}`;

  if (recentlyExecuted.has(key)) {
    console.log(`${MODULE_ID} | Skipping duplicate execution for ${itemName}`);
    return false;
  }

  // Add to set and remove after 500ms
  recentlyExecuted.add(key);
  setTimeout(() => recentlyExecuted.delete(key), 500);

  return true;
}

/**
 * Initialize the module
 */
Hooks.once("init", () => {
  console.log(`${MODULE_ID} | Initializing Consumable Macros module`);
});

/**
 * Log available macros on ready
 */
Hooks.once("ready", () => {
  console.log(`${MODULE_ID} | Module ready. Available macros:`, game.macros.contents.map(m => ({id: m.id, name: m.name})));
});

/**
 * Add macro section to item sheets
 */
Hooks.on("renderItemSheet", async (app, html, data) => {
  const item = app.item;

  console.log(`${MODULE_ID} | renderItemSheet called for ${item.name} (type: ${item.type})`);

  // Only add to consumable items
  if (item.type !== "consumable") return;

  // Get the stored macro UUID
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);

  // Get the macro from UUID (works for both world macros and compendium macros)
  let macro = null;
  if (macroUuid) {
    try {
      macro = await fromUuid(macroUuid);
    } catch (e) {
      console.warn(`${MODULE_ID} | Could not find macro ${macroUuid}`, e);
    }
  }

  console.log(`${MODULE_ID} | Macro UUID: ${macroUuid}, Macro found: ${!!macro}`, macro);

  // Find the details tab
  const detailsTab = html.find('.tab[data-tab="details"]');
  if (!detailsTab.length) {
    console.warn(`${MODULE_ID} | Details tab not found for ${item.name}`);
    return;
  }

  // Remove existing macro section if it exists (for re-renders)
  html.find('.consumable-macro-section').remove();

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

  console.log(`${MODULE_ID} | Macro section added to ${item.name}`);

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

    // Save the macro UUID to the item (works for both world and compendium macros)
    await item.setFlag(MODULE_ID, FLAG_MACRO_UUID, droppedMacro.uuid);

    console.log(`${MODULE_ID} | Saved macro UUID ${droppedMacro.uuid} to item ${item.name}`);

    ui.notifications.info(`Macro "${droppedMacro.name}" attached to ${item.name}`);

    // Re-render the sheet - force a full re-render
    app.render(true);
  });

  // Handle remove button
  html.find(".macro-remove").on("click", async (event) => {
    event.preventDefault();
    await item.unsetFlag(MODULE_ID, FLAG_MACRO_UUID);
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
  console.log(`${MODULE_ID} | preUpdateItem hook - item: ${item.name}, type: ${item.type}, userId: ${userId}, change:`, change);

  // Only process for the current user
  if (userId !== game.user.id) return;

  // Check if this is a consumable item being used
  if (item.type !== "consumable") return;

  // Check if quantity is being reduced (item being consumed)
  if (!change.system?.quantity) {
    console.log(`${MODULE_ID} | No quantity change detected`);
    return;
  }

  const oldQuantity = item.system.quantity;
  const newQuantity = change.system.quantity;

  console.log(`${MODULE_ID} | Quantity change: ${oldQuantity} -> ${newQuantity}`);

  // Only trigger if quantity is decreasing
  if (newQuantity >= oldQuantity) return;

  // Get the associated macro
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);
  console.log(`${MODULE_ID} | Looking for macro with UUID: ${macroUuid}`);

  if (!macroUuid) {
    console.log(`${MODULE_ID} | No macro attached to ${item.name}`);
    return;
  }

  const macro = await fromUuid(macroUuid);
  if (!macro) {
    console.warn(`${MODULE_ID} | Macro ${macroUuid} not found for item ${item.name}`);
    return;
  }

  // Check for duplicate execution
  if (!shouldExecuteMacro(item.name, macroUuid)) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | [preUpdateItem] Executing macro "${macro.name}" for consumed item "${item.name}"`);

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
 * Execute the macro when a consumable item is deleted (quantity was 1)
 * Try multiple hook names to catch different deletion methods
 */

// Store recently consumed items to execute macros after deletion
const consumedItems = new Map();

// Hook that fires BEFORE the item is deleted
Hooks.on("preDeleteItem", async (item, options, userId) => {
  console.log(`${MODULE_ID} | preDeleteItem hook - item: ${item.name}, type: ${item.type}, userId: ${userId}`);

  // Only process for the current user
  if (userId !== game.user.id) return;

  // Only process consumable items
  if (item.type !== "consumable") return;

  // Get the associated macro
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);
  if (!macroUuid) {
    console.log(`${MODULE_ID} | No macro attached to ${item.name}`);
    return;
  }

  // Store the item data and macro for execution after deletion
  consumedItems.set(item.id, {
    name: item.name,
    macroUuid: macroUuid,
    actor: item.parent
  });

  console.log(`${MODULE_ID} | Stored ${item.name} for post-deletion macro execution`);
});

// Alternative: Hook into document deletion at a lower level
Hooks.on("deleteItem", async (item, options, userId) => {
  console.log(`${MODULE_ID} | deleteItem hook - item: ${item.name}, type: ${item.type}, userId: ${userId}`);

  // Check if we stored this item for macro execution
  const storedData = consumedItems.get(item.id);
  if (!storedData) return;

  // Remove from storage
  consumedItems.delete(item.id);

  const macro = await fromUuid(storedData.macroUuid);
  if (!macro) {
    console.warn(`${MODULE_ID} | Macro ${storedData.macroUuid} not found`);
    return;
  }

  // Check for duplicate execution
  if (!shouldExecuteMacro(storedData.name, storedData.macroUuid)) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | [deleteItem] Executing macro "${macro.name}" for deleted item "${storedData.name}"`);

    const speaker = ChatMessage.getSpeaker();
    const actor = storedData.actor || ChatMessage.getSpeakerActor(speaker);
    const token = canvas.tokens.get(speaker.token);
    const character = game.user.character;

    await macro.execute({
      actor,
      token,
      character,
      item,
      speaker
    });

  } catch (err) {
    console.error(`${MODULE_ID} | Error executing macro for ${storedData.name}:`, err);
    ui.notifications.error(`Failed to execute macro: ${err.message}`);
  }
});

/**
 * Alternative hook for PF2e specific item usage
 */
Hooks.on("pf2e.useItem", async (item, event, target) => {
  console.log(`${MODULE_ID} | pf2e.useItem hook triggered for ${item.name}`);

  // Only process consumables
  if (item.type !== "consumable") return;

  // Get the associated macro
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);
  if (!macroUuid) return;

  const macro = await fromUuid(macroUuid);
  if (!macro) return;

  // Check for duplicate execution
  if (!shouldExecuteMacro(item.name, macroUuid)) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | [pf2e.useItem] Executing macro "${macro.name}" for used item "${item.name}"`);

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
  console.log(`${MODULE_ID} | pf2e.consumeItem hook triggered for ${item.name}`);

  // Get the associated macro
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);
  if (!macroUuid) return;

  const macro = await fromUuid(macroUuid);
  if (!macro) return;

  // Check for duplicate execution
  if (!shouldExecuteMacro(item.name, macroUuid)) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | [pf2e.consumeItem] Executing macro "${macro.name}" for consumed item "${item.name}"`);

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

/**
 * Hook into chat message creation to catch item usage
 * This is the primary way PF2e handles item consumption
 */
Hooks.on("createChatMessage", async (message, options, userId) => {
  console.log(`${MODULE_ID} | createChatMessage hook triggered, userId: ${userId}`);
  console.log(`${MODULE_ID} | Message data:`, {
    flavor: message.flavor,
    content: message.content?.substring(0, 200),
    flags: message.flags
  });

  // Only process for the current user
  if (userId !== game.user.id) return;

  // Try multiple ways to get the item from the message
  let item = message.item;
  console.log(`${MODULE_ID} | message.item:`, item);

  // If that doesn't work, try getting it from flags
  if (!item && message.flags?.pf2e?.context?.item) {
    const itemUuid = message.flags.pf2e.context.item;
    console.log(`${MODULE_ID} | Trying to get item from context UUID: ${itemUuid}`);
    try {
      item = await fromUuid(itemUuid);
      console.log(`${MODULE_ID} | Got item from context:`, item);
    } catch (e) {
      console.warn(`${MODULE_ID} | Could not get item from context UUID`, e);
    }
  }

  // Try getting from origin
  if (!item && message.flags?.pf2e?.origin?.uuid) {
    const originUuid = message.flags.pf2e.origin.uuid;
    console.log(`${MODULE_ID} | Trying to get item from origin UUID: ${originUuid}`);
    try {
      item = await fromUuid(originUuid);
      console.log(`${MODULE_ID} | Got item from origin:`, item);
    } catch (e) {
      console.warn(`${MODULE_ID} | Could not get item from origin UUID`, e);
    }

    // If fromUuid fails, try parsing the UUID to get the item directly from the actor
    if (!item && originUuid) {
      const uuidParts = originUuid.split('.');
      if (uuidParts.length >= 3 && uuidParts[0] === 'Actor' && uuidParts[2] === 'Item') {
        const actorId = uuidParts[1];
        const itemId = uuidParts[3];
        console.log(`${MODULE_ID} | Trying to get item ${itemId} from actor ${actorId}`);

        const actor = game.actors.get(actorId);
        if (actor) {
          item = actor.items.get(itemId);
          console.log(`${MODULE_ID} | Got item from actor directly:`, item);

          // If still not found, the item might have been a temporary copy
          // Try to extract item name from the message and search by name
          if (!item) {
            let itemName = null;

            // Try multiple patterns to extract the item name
            // Pattern 1: From flavor text
            if (message.flavor) {
              const flavorMatch = message.flavor.match(/data-item-id="[^"]*"[^>]*>([^<]+)</);
              if (flavorMatch) itemName = flavorMatch[1];
            }

            // Pattern 2: From content - "Uses ItemName" format
            if (!itemName && message.content) {
              console.log(`${MODULE_ID} | Trying to extract from content: "${message.content}"`);
              console.log(`${MODULE_ID} | Content type:`, typeof message.content, `Length: ${message.content.length}`);

              // Strip HTML tags if present
              const textContent = message.content.replace(/<[^>]*>/g, '').trim();
              console.log(`${MODULE_ID} | Stripped content: "${textContent}"`);

              // Match "Uses X" pattern
              const usesMatch = textContent.match(/^Uses\s+(.+)$/i);
              console.log(`${MODULE_ID} | usesMatch:`, usesMatch);

              if (usesMatch) {
                itemName = usesMatch[1].trim();
              } else {
                // Try other patterns
                const contentMatch = message.content.match(/data-item-name="([^"]+)"/);
                if (contentMatch) itemName = contentMatch[1];
              }
            }

            // Pattern 3: Look in flags
            if (!itemName && message.flags?.pf2e?.origin?.name) {
              itemName = message.flags.pf2e.origin.name;
            }

            console.log(`${MODULE_ID} | Extracted item name: "${itemName}"`);

            if (itemName) {
              console.log(`${MODULE_ID} | Searching for consumable item by name: "${itemName}"`);

              // First, try the actor's current inventory
              item = actor.items.find(i => i.name === itemName && i.type === 'consumable');
              console.log(`${MODULE_ID} | Found item in actor inventory:`, item);

              // If not found in actor, search world items (includes items in folders)
              if (!item) {
                console.log(`${MODULE_ID} | Searching world items for: "${itemName}"`);
                item = game.items.find(i => i.name === itemName && i.type === 'consumable');
                console.log(`${MODULE_ID} | Found item in world items:`, item);
              }

              // If still not found, try to get from compendium using sourceId
              if (!item && message.flags?.pf2e?.origin?.sourceId) {
                const sourceId = message.flags.pf2e.origin.sourceId;
                console.log(`${MODULE_ID} | Trying to get source item from compendium: ${sourceId}`);
                try {
                  const sourceItem = await fromUuid(sourceId);
                  if (sourceItem && sourceItem.name === itemName) {
                    console.log(`${MODULE_ID} | Got source item from compendium:`, sourceItem);
                    item = sourceItem;
                  }
                } catch (e) {
                  console.warn(`${MODULE_ID} | Could not get source item from compendium`, e);
                }
              }
            }
          }

          // Debug: Log all actor items if we still can't find it
          if (!item) {
            console.log(`${MODULE_ID} | Could not find item. Actor's consumable items:`);
            const consumables = actor.items.filter(i => i.type === 'consumable');
            console.log(consumables.map(i => ({id: i.id, name: i.name})));
          }
        }
      }
    }
  }

  if (!item) {
    console.log(`${MODULE_ID} | No item found in message - tried all methods`);
    return;
  }

  console.log(`${MODULE_ID} | createChatMessage hook - item: ${item.name}, type: ${item.type}`);

  // Only process consumables
  if (item.type !== "consumable") return;

  // Get the associated macro
  const macroUuid = item.getFlag(MODULE_ID, FLAG_MACRO_UUID);
  if (!macroUuid) {
    console.log(`${MODULE_ID} | No macro attached to item ${item.name}`);
    return;
  }

  const macro = await fromUuid(macroUuid);
  if (!macro) {
    console.warn(`${MODULE_ID} | Macro ${macroUuid} not found`);
    return;
  }

  // Check for duplicate execution
  if (!shouldExecuteMacro(item.name, macroUuid)) return;

  // Execute the macro
  try {
    console.log(`${MODULE_ID} | [createChatMessage] Executing macro "${macro.name}" for item "${item.name}"`);

    const speaker = message.speaker;
    const actor = ChatMessage.getSpeakerActor(speaker);
    const token = canvas.tokens.get(speaker.token);
    const character = game.user.character;

    await macro.execute({
      actor,
      token,
      character,
      item,
      speaker,
      message
    });

  } catch (err) {
    console.error(`${MODULE_ID} | Error executing macro for ${item.name}:`, err);
    ui.notifications.error(`Failed to execute macro: ${err.message}`);
  }
});

console.log(`${MODULE_ID} | Consumable Macros module loaded`);
