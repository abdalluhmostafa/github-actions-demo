// test/test.js

const { expect } = require('chai');

describe('Sample Test', () => {
  it('should return true', () => {
    expect(true).to.be.true;
  });

  it('should return 2 when adding 1 + 1', () => {
    expect(1 + 1).to.equal(2);
  });
});
