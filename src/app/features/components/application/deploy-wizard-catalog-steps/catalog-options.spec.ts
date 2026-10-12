import { catalogOptionBlocked, catalogOptionEnabled } from './catalog-options';

const options = [
  { key: 'pooler', default: true },
  { key: 'poolerSessionMode', default: false, requires: 'pooler' },
];

describe('catalog install options', () => {
  it('reads the defaults when nothing was touched', () => {
    expect(catalogOptionEnabled(options, {}, 'pooler')).toBeTrue();
    expect(catalogOptionEnabled(options, {}, 'poolerSessionMode')).toBeFalse();
    expect(catalogOptionBlocked(options, {}, 'poolerSessionMode')).toBeFalse();
  });

  it('turns session pooling off and blocks it while the pooler is off', () => {
    const toggles = { pooler: false, poolerSessionMode: true };
    expect(catalogOptionEnabled(options, toggles, 'poolerSessionMode')).toBeFalse();
    expect(catalogOptionBlocked(options, toggles, 'poolerSessionMode')).toBeTrue();
  });

  it('keeps session pooling when the pooler is on', () => {
    expect(
      catalogOptionEnabled(options, { poolerSessionMode: true }, 'poolerSessionMode'),
    ).toBeTrue();
  });
});
