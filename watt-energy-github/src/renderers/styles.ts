export const CARD_STYLES = [
  { id: "spotlight", name: "Spotlight", tag: "Photo" },
  { id: "frame", name: "Frame", tag: "Photo" },
  { id: "dashboard", name: "Dashboard", tag: "Data" },
  { id: "rings", name: "Rings", tag: "Data" },
];

export const DAY_CARD_STYLES = [
  { id: "energy", name: "Performance" },
  { id: "messages", name: "Messages" },
  { id: "recap", name: "Photo grid" },
  { id: "ledger", name: "Ledger" },
  { id: "splits", name: "Splits" },
];

// 20 authentic iMessage-style stickers (blue/green bubbles, lock-screen
// notifications, threads, tapbacks). `tag` groups them in the picker.
export const STICKER_STYLES = [
  { id: "blueMeal", name: "Meal", tag: "Blue" },
  { id: "blueFull", name: "Full breakdown", tag: "Blue" },
  { id: "blueMacros", name: "Macros", tag: "Blue" },
  { id: "blueKcal", name: "Calories", tag: "Blue" },
  { id: "blueProtein", name: "Protein", tag: "Blue" },
  { id: "blueStreak", name: "Daily", tag: "Blue" },
  { id: "doubleBlue", name: "Double bubble", tag: "Blue" },
  { id: "greenMeal", name: "Meal", tag: "Green" },
  { id: "greenMacros", name: "Macros", tag: "Green" },
  { id: "lockMeal", name: "Meal", tag: "Notification" },
  { id: "lockMacros", name: "Macros", tag: "Notification" },
  { id: "lockProtein", name: "Protein", tag: "Notification" },
  { id: "banner", name: "Banner", tag: "Notification" },
  { id: "stack", name: "Stack", tag: "Notification" },
  { id: "thread", name: "Meal reply", tag: "Thread" },
  { id: "threadMacros", name: "Macro reply", tag: "Thread" },
  { id: "contact", name: "Contact card", tag: "Thread" },
  { id: "tapback", name: "Tapback", tag: "Reaction" },
  { id: "delivered", name: "Delivered", tag: "Reaction" },
  { id: "typing", name: "Typing", tag: "Reaction" },
  // Energy in vs out — the showcase metric. iMessage-styled, like the rest.
  { id: "ioBlue", name: "In · Out", tag: "Energy" },
  { id: "ioNet", name: "Net energy", tag: "Energy" },
  { id: "ioThread", name: "Balance reply", tag: "Energy" },
  { id: "ioDouble", name: "Fuel & burn", tag: "Energy" },
  { id: "ioGreen", name: "In · Out (green)", tag: "Energy" },
  { id: "ioLock", name: "Balance alert", tag: "Energy" },
];

// curated, photo-legible ink palette for stickers (custom picker covers the rest)
export const STICKER_INKS = ["#F4F1E9", "#FFFFFF", "#16140F", "#A9C3B7", "#E6C49A", "#E5A0A0", "#9BB8D9", "#D9B8E0", "#F2D479"];
