# Example Macros for Consumable Items

This document contains example macros you can use with the Consumable Macros module. Copy and paste these into new macros in Foundry VTT.

## Available Variables

All macros executed from consumable items have access to these variables:

- `actor` - The actor using the item
- `token` - The token of the actor on the canvas
- `item` - The consumable item being used
- `character` - The current user's character
- `speaker` - The ChatMessage speaker object

---

## Survival System Macros

### Basic Thirst Reduction (Ale, Water)

```javascript
// Reduce thirst when drinking
if (actor) {
  const currentThirst = actor.getFlag("world", "thirst") || 0;
  const reduction = 20; // Adjust this value based on the drink

  const newThirst = Math.max(0, currentThirst - reduction);
  await actor.setFlag("world", "thirst", newThirst);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name}.<br>Thirst: ${currentThirst} → ${newThirst}`,
    flavor: "💧 Hydration"
  });
}
```

### Basic Hunger Reduction (Food)

```javascript
// Reduce hunger when eating
if (actor) {
  const currentHunger = actor.getFlag("world", "hunger") || 0;
  const reduction = 25; // Adjust based on food type

  const newHunger = Math.max(0, currentHunger - reduction);
  await actor.setFlag("world", "hunger", newHunger);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> eats ${item.name}.<br>Hunger: ${currentHunger} → ${newHunger}`,
    flavor: "🍖 Sustenance"
  });
}
```

### Ale with Debuff

```javascript
// Drinking ale reduces thirst but applies a temporary debuff
if (actor) {
  // Reduce thirst
  const currentThirst = actor.getFlag("world", "thirst") || 0;
  const newThirst = Math.max(0, currentThirst - 15);
  await actor.setFlag("world", "thirst", newThirst);

  // Apply slight intoxication effect (adjust to your system)
  const effectData = {
    name: "Tipsy",
    icon: item.img,
    duration: { seconds: 300 }, // 5 minutes
    changes: [
      {
        key: "system.attributes.ac.value",
        mode: 2,
        value: -1
      }
    ]
  };

  await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name} and feels a bit tipsy.<br>Thirst reduced by 15.`,
    flavor: "🍺 Ale"
  });
}
```

---

## Healing Macros

### Simple Healing Potion

```javascript
// Basic healing potion
if (actor) {
  const healAmount = new Roll("2d8+4");
  await healAmount.evaluate();

  await actor.applyDamage(-healAmount.total); // Negative = healing

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name} and recovers <strong>${healAmount.total} HP</strong>!`,
    flavor: "💊 Healing Potion",
    rolls: [healAmount]
  });
}
```

### Greater Healing Potion

```javascript
// Greater healing potion with visual effects
if (actor) {
  const healAmount = new Roll("4d8+8");
  await healAmount.evaluate();

  await actor.applyDamage(-healAmount.total);

  // Optional: Play a sound effect
  AudioHelper.play({ src: "sounds/heal.wav", volume: 0.5 });

  await ChatMessage.create({
    speaker: speaker,
    content: `<div style="text-align: center;">
      <strong style="color: #4a9eff;">${actor.name}</strong> drinks ${item.name}!<br>
      <span style="color: #4eff4a; font-size: 1.2em;">+${healAmount.total} HP</span>
    </div>`,
    flavor: "💙 Greater Healing Potion",
    rolls: [healAmount]
  });
}
```

---

## Buff/Debuff Macros

### Strength Potion

```javascript
// Potion that grants +2 Strength for 1 hour
if (actor) {
  const effectData = {
    name: "Potion of Strength",
    icon: item.img,
    duration: { seconds: 3600 }, // 1 hour
    changes: [
      {
        key: "system.abilities.str.value",
        mode: 2,
        value: 2
      }
    ]
  };

  await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name} and feels incredibly strong! (+2 Strength for 1 hour)`,
    flavor: "💪 Potion of Strength"
  });
}
```

### Antidote

```javascript
// Remove poison effects
if (actor) {
  const poisonEffects = actor.effects.filter(e =>
    e.name.toLowerCase().includes("poison") ||
    e.name.toLowerCase().includes("venom")
  );

  if (poisonEffects.length > 0) {
    for (let effect of poisonEffects) {
      await effect.delete();
    }

    await ChatMessage.create({
      speaker: speaker,
      content: `<strong>${actor.name}</strong> uses ${item.name} and feels the poison fade away!`,
      flavor: "🧪 Antidote"
    });
  } else {
    await ChatMessage.create({
      speaker: speaker,
      content: `<strong>${actor.name}</strong> uses ${item.name}, but wasn't poisoned.`,
      flavor: "🧪 Antidote"
    });
  }
}
```

---

## Interactive Macros

### Mystery Potion (Random Effect)

```javascript
// Random effect potion
if (actor) {
  const effects = [
    { name: "Healing", roll: "2d8", type: "heal" },
    { name: "Damage", roll: "1d6", type: "damage" },
    { name: "Speed Boost", duration: 600, stat: "system.attributes.speed.total", value: 10 },
    { name: "Temporary HP", roll: "1d10", type: "temp-hp" }
  ];

  const randomEffect = effects[Math.floor(Math.random() * effects.length)];

  let message = "";

  if (randomEffect.type === "heal") {
    const roll = new Roll(randomEffect.roll);
    await roll.evaluate();
    await actor.applyDamage(-roll.total);
    message = `heals for <strong style="color: #4eff4a;">${roll.total} HP</strong>!`;
  } else if (randomEffect.type === "damage") {
    const roll = new Roll(randomEffect.roll);
    await roll.evaluate();
    await actor.applyDamage(roll.total);
    message = `takes <strong style="color: #ff4a4a;">${roll.total} damage</strong>!`;
  } else if (randomEffect.stat) {
    const effectData = {
      name: `Mystery Potion: ${randomEffect.name}`,
      icon: item.img,
      duration: { seconds: randomEffect.duration },
      changes: [{
        key: randomEffect.stat,
        mode: 2,
        value: randomEffect.value
      }]
    };
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);
    message = `gains <strong>${randomEffect.name}</strong> for ${randomEffect.duration / 60} minutes!`;
  } else if (randomEffect.type === "temp-hp") {
    const roll = new Roll(randomEffect.roll);
    await roll.evaluate();
    await actor.update({ "system.attributes.hp.temp": roll.total });
    message = `gains <strong>${roll.total} temporary HP</strong>!`;
  }

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks the ${item.name} and ${message}`,
    flavor: "❓ Mystery Potion"
  });
}
```

### Confirmation Dialog

```javascript
// Potion that asks for confirmation before use
if (actor) {
  const confirmed = await Dialog.confirm({
    title: item.name,
    content: `<p>This ${item.name} will restore health but may have side effects. Are you sure you want to drink it?</p>`,
    yes: () => true,
    no: () => false
  });

  if (confirmed) {
    // Healing
    const healRoll = new Roll("3d8+6");
    await healRoll.evaluate();
    await actor.applyDamage(-healRoll.total);

    // Side effect - random ability penalty
    const abilities = ["str", "dex", "con", "int", "wis", "cha"];
    const randomAbility = abilities[Math.floor(Math.random() * abilities.length)];

    const effectData = {
      name: "Potion Side Effect",
      icon: item.img,
      duration: { seconds: 600 },
      changes: [{
        key: `system.abilities.${randomAbility}.value`,
        mode: 2,
        value: -2
      }]
    };
    await actor.createEmbeddedDocuments("ActiveEffect", [effectData]);

    await ChatMessage.create({
      speaker: speaker,
      content: `<strong>${actor.name}</strong> drinks ${item.name}!<br>
        Healed for <strong style="color: #4eff4a;">${healRoll.total} HP</strong><br>
        But suffers -2 ${randomAbility.toUpperCase()} for 10 minutes!`,
      flavor: "⚗️ Unstable Potion",
      rolls: [healRoll]
    });
  }
}
```

---

## Advanced Macros

### Check Prerequisites

```javascript
// Only allow use if certain conditions are met
if (actor) {
  const currentHP = actor.system.attributes.hp.value;
  const maxHP = actor.system.attributes.hp.max;

  if (currentHP === maxHP) {
    ui.notifications.warn(`${actor.name} is already at full health!`);

    // Refund the item (add 1 back to quantity)
    await item.update({ "system.quantity": item.system.quantity + 1 });
    return;
  }

  // Proceed with healing
  const healAmount = new Roll("2d8+4");
  await healAmount.evaluate();

  const actualHealing = Math.min(healAmount.total, maxHP - currentHP);
  await actor.applyDamage(-actualHealing);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name} and recovers ${actualHealing} HP!`,
    flavor: "💊 Healing Potion"
  });
}
```

### Chain Multiple Effects

```javascript
// Potion with multiple staged effects
if (actor) {
  // Immediate healing
  const initialHeal = new Roll("1d8+2");
  await initialHeal.evaluate();
  await actor.applyDamage(-initialHeal.total);

  await ChatMessage.create({
    speaker: speaker,
    content: `<strong>${actor.name}</strong> drinks ${item.name} and immediately recovers ${initialHeal.total} HP!`,
    flavor: "🌟 Potion of Regeneration"
  });

  // Add regeneration effect for 1 minute
  const regenEffect = {
    name: "Regeneration",
    icon: item.img,
    duration: { seconds: 60 },
    changes: []
  };

  await actor.createEmbeddedDocuments("ActiveEffect", [regenEffect]);

  // Schedule additional healing every 10 seconds (requires GM to handle or use additional module)
  await ChatMessage.create({
    speaker: speaker,
    content: `${actor.name} continues to regenerate health for the next minute!`,
    whisper: [game.user.id]
  });
}
```

---

## Tips for Writing Macros

1. **Always check if actor exists** - Use `if (actor)` to prevent errors
2. **Use ChatMessage.create()** - Provide feedback to players
3. **Test incrementally** - Start simple and add complexity
4. **Use flags for custom data** - `actor.getFlag()` and `actor.setFlag()`
5. **Check the console** - F12 to see errors
6. **Make effects temporary** - Use duration for buffs/debuffs
7. **Consider edge cases** - What if HP is already full?
8. **Provide visual feedback** - Colors, icons, and formatting matter

---

## Need More Help?

- Check the [Foundry VTT API Documentation](https://foundryvtt.com/api/)
- Visit the [PF2e System Documentation](https://github.com/foundryvtt/pf2e)
- Join the Foundry VTT Discord for community support
