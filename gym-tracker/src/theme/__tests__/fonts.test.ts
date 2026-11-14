/* eslint-disable @typescript-eslint/no-require-imports -- each test needs a fresh module instance */
describe('font fallback', () => {
  beforeEach(() => jest.resetModules());

  it('uses bundled families by default', () => {
    const { typographyFor, font } = require('../tokens');
    expect(typographyFor('title')).toMatchObject({ fontFamily: 'SpaceGrotesk_700Bold', fontSize: 22 });
    expect(font('bold')).toEqual({ fontFamily: 'Inter_700Bold' });
  });

  it('keeps weights with the system font when bundled fonts fail', () => {
    const { typographyFor, font, enableSystemFontFallback } = require('../tokens');
    enableSystemFontFallback();
    expect(typographyFor('title')).toEqual({ fontSize: 22, letterSpacing: -0.3, fontWeight: '700' });
    expect(typographyFor('label')).toMatchObject({ fontWeight: '600', textTransform: 'uppercase' });
    expect(font('regular')).toEqual({ fontWeight: '400' });
    expect(typographyFor('body')).not.toHaveProperty('fontFamily');
  });
});
