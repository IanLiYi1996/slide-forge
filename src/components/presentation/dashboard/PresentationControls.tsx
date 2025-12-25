import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { usePresentationState } from "@/states/presentation-state";
import { ModelPicker } from "./ModelPicker";

export function PresentationControls({
  shouldShowLabel = true,
}: {
  shouldShowLabel?: boolean;
}) {
  const {
    numSlides,
    setNumSlides,
    language,
    setLanguage,
  } = usePresentationState();

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Model Name */}
      <ModelPicker shouldShowLabel={shouldShowLabel} />

      {/* Number of Slides */}
      <div>
        {shouldShowLabel && (
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Number of slides
          </label>
        )}
        <Input
          type="number"
          min={1}
          max={50}
          value={numSlides}
          onChange={(e) => {
            const value = parseInt(e.target.value);
            if (!isNaN(value) && value >= 1 && value <= 50) {
              setNumSlides(value);
            } else if (e.target.value === "") {
              // Allow empty for editing, will default to 5 on blur
              setNumSlides(5);
            }
          }}
          onBlur={(e) => {
            // Ensure valid value on blur
            const value = parseInt(e.target.value);
            if (isNaN(value) || value < 1) {
              setNumSlides(5);
            } else if (value > 50) {
              setNumSlides(50);
            }
          }}
          placeholder="Enter number (1-50)"
          className="h-10"
        />
      </div>

      {/* Language */}
      <div>
        {shouldShowLabel && (
          <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
            Language
          </label>
        )}
        <Select value={language} onValueChange={setLanguage}>
          <SelectTrigger>
            <SelectValue placeholder="Select language" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="en-US">English (US)</SelectItem>
            <SelectItem value="pt">Portuguese</SelectItem>
            <SelectItem value="es">Spanish</SelectItem>
            <SelectItem value="fr">French</SelectItem>
            <SelectItem value="de">German</SelectItem>
            <SelectItem value="it">Italian</SelectItem>
            <SelectItem value="ja">Japanese</SelectItem>
            <SelectItem value="ko">Korean</SelectItem>
            <SelectItem value="zh">Chinese</SelectItem>
            <SelectItem value="ru">Russian</SelectItem>
            <SelectItem value="hi">Hindi</SelectItem>
            <SelectItem value="ar">Arabic</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}
