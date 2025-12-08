# Consumable Macros

A Foundry VTT module that restores the ability to attach macros to consumable items. When a consumable item is used, the attached macro will automatically execute. Perfect for survival systems, custom item effects, and more!

## Features

- **Drag & Drop Interface**: Simply drag a macro from your macro directory onto a consumable item's Details tab
- **Visual Feedback**: See which macro is attached to each consumable item
- **Easy Management**: Click the X button to remove an attached macro, or click the macro to view/edit it
- **PF2e Support**: Specifically designed to work with Pathfinder 2e system on Foundry V13
- **Automatic Execution**: Macros execute automatically when the consumable item is used
- **Context Variables**: Macros have access to `actor`, `token`, `item`, `character`, and `speaker` variables

## Installation

### Method 1: Manual Installation

1. Download this module
2. Extract it to your Foundry VTT `Data/modules` directory
3. The folder should be named `consumable-macros`
4. Restart Foundry VTT
5. Enable the module in your world's module settings

### Method 2: Module Browser

1. In Foundry VTT, go to **Add-on Modules**
2. Click **Install Module**
3. Search for "Consumable Macros"
4. Click **Install**
5. Enable the module in your world

## Usage

### Attaching a Macro to a Consumable Item

1. Create or open a consumable item (e.g., Ale, Potion, Food)
2. Navigate to the **Details** tab
3. Scroll down to find the "Consumable Macro" section
4. Drag a macro from your macro directory and drop it into the drop zone
5. The macro is now attached and will execute when the item is used!

### Creating a Macro for Your Consumable

Macros attached to consumables have access to several useful variables:

```javascript
// Available variables in your macro:
// - actor: The actor using the item
// - token: The token of the actor
// - item: The consumable item being used
// - character: The current user's character
// - speaker: The ChatMessage speaker object

// Example: Healing macro for a healing potion
if (actor) {
  const healAmount = 2; // Roll 2d8+4
  const roll = new Roll("2d8+4");
  await roll.evaluate();

  await actor.applyDamage(-roll.total); // Negative damage = healing

  await ChatMessage.create({
    speaker: speaker,
    content: `${actor.name} drinks ${item.name} and recovers ${roll.total} HP!`,
    flavor: "Healing Potion Effect",
    rolls: [roll]
  });
}
```

```javascript
// Example: Survival system - thirst reduction
if (actor) {
  const currentThirst = actor.getFlag("world", "thirst") || 0;
  const reduction = 20; // Ale reduces thirst by 20

  await actor.setFlag("world", "thirst", Math.max(0, currentThirst - reduction));

  await ChatMessage.create({
    speaker: speaker,
    content: `${actor.name} drinks ${item.name}. Thirst reduced by ${reduction}.`,
    flavor: "Survival System"
  });
}
```

```javascript
// Example: Apply a buff effect
if (actor) {
  const effectData = {
    name: "Ale - Emboldened",
    icon: item.img,
    duration: { seconds: 600 }, // 10 minutes
    changes: [
      {
        key: "system.abilities.cha.mod",
        mode: 2,
        value: 1
      }
    ]
  };

  await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

  await ChatMessage.create({
    speaker: speaker,
    content: `${actor.name} feels emboldened after drinking ${item.name}!`
  });
}
```

### Removing a Macro

1. Open the consumable item
2. Go to the **Details** tab
3. Click the **X** button in the top-right corner of the macro section
4. The macro is now removed (but not deleted from your macro directory)

### Viewing/Editing the Attached Macro

1. Open the consumable item
2. Go to the **Details** tab
3. Click on the macro name or icon
4. The macro sheet will open for viewing or editing

## How It Works

The module hooks into Foundry VTT's item system and adds a new section to the Details tab of consumable items. When you use a consumable item, the module:

1. Detects that the item is being consumed
2. Checks if a macro is attached
3. Executes the macro with relevant context variables
4. Continues with the normal item consumption process

## Compatibility

- **Foundry VTT**: V12+ (verified for V13)
- **Game System**: Designed for PF2e, but should work with other systems that use consumable items
- **Other Modules**: Should be compatible with most modules

## Support for Survival Systems

This module is perfect for survival systems! You can create macros that:

- Reduce hunger/thirst values
- Apply temporary buffs or debuffs
- Trigger custom dialog boxes
- Update actor flags
- Create chat messages
- Play sounds or animations
- And much more!

## Troubleshooting

### The macro doesn't execute when I use the item

- Make sure the item type is "consumable"
- Verify the macro is properly attached (you should see it in the Details tab)
- Check the browser console (F12) for any error messages
- Ensure the macro doesn't have syntax errors

### The drop zone doesn't appear

- Confirm the module is enabled
- Make sure you're on the Details tab
- Verify the item is a consumable type
- Try refreshing the item sheet

### The macro executes but doesn't work as expected

- Check that your macro code is correct
- Verify you're using the available variables (`actor`, `token`, `item`, etc.)
- Look for error messages in the console (F12)
- Test the macro independently first

## Contributing

Contributions are welcome! Please feel free to submit issues or pull requests.

## License

This module is licensed under the OGL (Open Gaming License), compatible with Pathfinder 2e content.

## Credits

Created to restore functionality that was removed in Foundry VTT V13, helping GMs maintain their survival systems and custom item effects.

## Changelog

### Version 1.0.0
- Initial release
- Drag and drop macro attachment
- Automatic macro execution on item use
- PF2e system support
- Visual interface on Details tab
