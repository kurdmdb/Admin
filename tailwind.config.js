/** @type {import('tailwindcss').Config} */
module.exports = {
  // index.html is the only file with class="..." markup in this project (a
  // single static page). Tailwind's build-time scanner only picks up class
  // names that appear as literal strings in this glob - it cannot see a
  // class name assembled at runtime (e.g. `text-${color}-500` built in
  // JavaScript). The file was checked for that pattern before this config
  // was written and none was found, so scanning index.html alone is safe
  // here. If any class name is ever constructed dynamically in a template
  // literal later, it must be added to the safelist below or it will be
  // silently missing from the compiled CSS.
  content: ["./index.html"],
  safelist: [
    // Add any class names built dynamically in <script> (e.g. via
    // `className = 'text-' + color + '-500'`) here, verbatim, so the
    // scanner keeps them even though it can't find them as literal text.
  ],
  theme: {
    extend: {},
  },
  plugins: [],
};
