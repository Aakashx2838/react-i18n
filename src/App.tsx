import { useTranslation } from "react-i18next";
import { useIntl } from "./utils/intl";

function App() {
  const { i18n } = useTranslation();
  const intl = useIntl();

  return (
    <div>
      <select
        value={i18n.language}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
      >
        <option value="en">English</option>
        <option value="fr">Français</option>
        <option value="es">Español</option>
      </select>

      {/* Plain string — no options needed */}
      <div>{intl("Welcome to React")}</div>

      {/* Single interpolation variable */}
      <div>{intl("Hello {{name}}", { name: "Aakash" })}</div>

      {/* Multiple interpolation variables */}
      <div>
        {intl("{{name}} has {{count}} unread messages", {
          name: "Aakash",
          count: 12,
        })}
      </div>

      {/* Pluralization with count */}
      <div>{intl("{{count}} item |||| {{count}} items", { count: 1 })}</div>
      <div>{intl("{{count}} item |||| {{count}} items", { count: 5 })}</div>

      {/* Pluralization with extra variables */}
      <div>
        {intl(
          "{{name}} has {{count}} notification |||| {{name}} has {{count}} notifications",
          {
            name: "Aakash",
            count: 1,
          },
        )}
      </div>
      <div>
        {intl(
          "{{name}} has {{count}} notification |||| {{name}} has {{count}} notifications",
          {
            name: "Aakash",
            count: 99,
          },
        )}
      </div>

      {/* Multiple different variables */}
      <div>
        {intl("{{city}}, {{country}} — {{temperature}}°C", {
          city: "Kathmandu",
          country: "Nepal",
          temperature: 28,
        })}
      </div>
    </div>
  );
}

export default App;
