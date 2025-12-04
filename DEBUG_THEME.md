# Debugging Theme Issues in Production

## What I've Added

1. **Console Logging**: The form now logs detailed theme information to the browser console
2. **Visual Debug Panel**: A debug panel appears at the top of the form showing theme state

## How to Debug in Production

### Step 1: Open Browser DevTools
- Press `F12` or `Cmd+Option+I` (Mac) / `Ctrl+Shift+I` (Windows/Linux)
- Go to the **Console** tab

### Step 2: Check Console Logs
Look for logs starting with `🔍 [CallRequestForm] Theme Debug Info:` which will show:
- Current theme state
- HTML classes on `<html>` element
- Whether `dark` or `light` class is present
- localStorage theme value
- System preference (dark/light)
- CSS variable values (`--foreground`, `--background`, `--muted-foreground`)

### Step 3: Inspect the HTML Element
In the **Elements** tab (or **Inspector**):
1. Find the `<html>` element at the top
2. Check what classes it has:
   - Should have either `dark` or `light` class
   - If it has `dark`, that's why text is white!

### Step 4: Check CSS Variables
1. Select the `<html>` element
2. In the **Styles** panel, look for CSS variables:
   - `--foreground`: Should be dark color (not white)
   - `--muted-foreground`: Should be dark gray (not white)
   - `--background`: Should be light color

### Step 5: Check Computed Styles
1. Select a text element (like a label or input placeholder)
2. In **Computed** tab, check:
   - `color`: Should be dark, not white
   - If it's white (`rgb(255, 255, 255)` or `#ffffff`), that's the problem!

### Step 6: Check Media Query
In the **Console**, run:
```javascript
window.matchMedia("(prefers-color-scheme: dark)").matches
```
- `true` = System prefers dark mode (this might be triggering dark mode!)
- `false` = System prefers light mode

### Step 7: Check localStorage
In the **Console**, run:
```javascript
localStorage.getItem("theme")
```
- `null` = Using system preference
- `"dark"` = Dark mode forced
- `"light"` = Light mode forced

## Common Issues to Look For

1. **HTML has `dark` class but shouldn't**
   - Fix: Check why theme provider is applying dark mode
   - Check system preference and localStorage

2. **CSS variables are white in light mode**
   - Fix: Check if `.dark` class is being applied incorrectly
   - Verify CSS variable definitions in `styles.css`

3. **Text color is white but background is light**
   - This means dark mode styles are being applied
   - Check if `dark:` Tailwind classes are being used incorrectly

## Quick Fixes to Try

### Force Light Mode (Temporary)
In the **Console**, run:
```javascript
document.documentElement.classList.remove('dark');
document.documentElement.classList.add('light');
localStorage.setItem('theme', 'light');
```
Then refresh the page to see if that fixes it.

### Check What's Different
Compare these values between local and production:
- `document.documentElement.className`
- `localStorage.getItem("theme")`
- `window.matchMedia("(prefers-color-scheme: dark)").matches`
- CSS variable values

## After Debugging

Once you've identified the issue, remove the debug panel from `call-request-form.tsx`:
- Remove the debug panel div (lines ~495-507)
- Remove the `useTheme` import if not needed elsewhere
- Remove the debug `useEffect` hook

