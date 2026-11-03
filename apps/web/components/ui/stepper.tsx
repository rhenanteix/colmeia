import { Button } from './button';
export function Stepper({
  steps,
  current,
  onChange,
  disabled,
}: {
  steps: readonly string[];
  current: number;
  onChange: (step: number) => void;
  disabled?: boolean;
}) {
  return (
    <nav className="builder-steps" aria-label="Etapas de configuração">
      {steps.map((step, index) => (
        <Button
          key={step}
          variant={current === index ? 'default' : 'secondary'}
          className="h-auto min-h-10 justify-start whitespace-normal text-left"
          aria-current={current === index ? 'step' : undefined}
          disabled={disabled}
          onClick={() => onChange(index)}
        >
          {index + 1}. {step}
        </Button>
      ))}
    </nav>
  );
}
