import { describe, it, expect } from 'vitest';
import { generatePromptVariables, replacePromptVariables } from '../../src/utils/prompt-replacer.js';

describe('prompt-replacer', () => {
  describe('generatePromptVariables', () => {
    it('should generate variables with lastDeliveredAt', () => {
      const lastDelivered = new Date('2024-12-09T00:00:00');
      const current = new Date('2024-12-16T00:00:00');

      const vars = generatePromptVariables(lastDelivered, current);

      expect(vars.today).toBe('2024年12月16日');
      expect(vars.period).toBe('2024年12月9日から2024年12月16日まで');
      expect(vars.days).toBe('7');
    });

    it('should default to 7 days ago when no lastDeliveredAt', () => {
      const current = new Date('2024-12-16T00:00:00');

      const vars = generatePromptVariables(undefined, current);

      expect(vars.today).toBe('2024年12月16日');
      expect(vars.period).toBe('2024年12月9日から2024年12月16日まで');
      expect(vars.days).toBe('7');
    });

    it('should handle different date ranges', () => {
      const lastDelivered = new Date('2024-12-01T00:00:00');
      const current = new Date('2024-12-15T00:00:00');

      const vars = generatePromptVariables(lastDelivered, current);

      expect(vars.days).toBe('14');
      expect(vars.period).toBe('2024年12月1日から2024年12月15日まで');
    });
  });

  describe('replacePromptVariables', () => {
    it('should replace {{period}} variable', () => {
      const prompt = '{{period}}のニュースを収集してください。';
      const lastDelivered = new Date('2024-12-09T00:00:00');
      const current = new Date('2024-12-16T00:00:00');

      const result = replacePromptVariables(prompt, lastDelivered, current);

      expect(result).toBe('2024年12月9日から2024年12月16日までのニュースを収集してください。');
    });

    it('should replace {{today}} variable', () => {
      const prompt = '{{today}}時点の情報をまとめてください。';
      const current = new Date('2024-12-16T00:00:00');

      const result = replacePromptVariables(prompt, undefined, current);

      expect(result).toBe('2024年12月16日時点の情報をまとめてください。');
    });

    it('should replace {{days}} variable', () => {
      const prompt = '過去{{days}}日間のニュースを収集。';
      const lastDelivered = new Date('2024-12-09T00:00:00');
      const current = new Date('2024-12-16T00:00:00');

      const result = replacePromptVariables(prompt, lastDelivered, current);

      expect(result).toBe('過去7日間のニュースを収集。');
    });

    it('should replace multiple variables', () => {
      const prompt = '{{period}}（{{days}}日間）の最新情報。発行日: {{today}}';
      const lastDelivered = new Date('2024-12-09T00:00:00');
      const current = new Date('2024-12-16T00:00:00');

      const result = replacePromptVariables(prompt, lastDelivered, current);

      expect(result).toBe('2024年12月9日から2024年12月16日まで（7日間）の最新情報。発行日: 2024年12月16日');
    });

    it('should handle prompt without variables', () => {
      const prompt = 'AIニュースを収集してください。';

      const result = replacePromptVariables(prompt);

      expect(result).toBe('AIニュースを収集してください。');
    });

    it('should replace multiple occurrences of same variable', () => {
      const prompt = '{{today}}のニュース。配信日: {{today}}';
      const current = new Date('2024-12-16T00:00:00');

      const result = replacePromptVariables(prompt, undefined, current);

      expect(result).toBe('2024年12月16日のニュース。配信日: 2024年12月16日');
    });
  });
});
