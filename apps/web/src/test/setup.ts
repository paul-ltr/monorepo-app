import '@testing-library/jest-dom/vitest';
import { expect } from 'vitest';
import * as axeMatchers from 'vitest-axe/matchers';
import '../i18n'; // initialize i18next (FR) for components using useTranslation

expect.extend(axeMatchers);
