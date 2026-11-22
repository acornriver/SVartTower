/** One media element feeds both EQ chains so switching preserves the playhead. */
class EarComparison {
  constructor(media) {
    this.media = media;
    this.context = null;
    this.mix = 0; // 0 = 내 귀, 1 = 고른 달팽이의 귀 (11/22 슬라이더)
  }

  createChain(source, output) {
    const filters = ['lowshelf', 'peaking', 'highshelf'].map(type => {
      const filter = this.context.createBiquadFilter();
      filter.type = type;
      filter.Q.value = 1;
      return filter;
    });
    const level = this.context.createGain();
    const mix = this.context.createGain();
    mix.gain.value = 0;
    const nodes = [source, ...filters, level, mix, output];
    nodes.slice(0, -1).forEach((node, i) => node.connect(nodes[i + 1]));
    return { filters, level, mix };
  }

  configure(own, other, mix) {
    this.own = own;
    this.other = other;
    this.mix = Math.max(0, Math.min(1, mix));
    if (!this.context) return;
    this.setFilters(this.chains.own, own);
    this.setFilters(this.chains.other, other);
    const time = this.context.currentTime;
    // 같은 크기로 섞이게 (equal-power). 한쪽 귀만 있으면 그 귀만
    const m = !this.own ? 1 : !this.other ? 0 : this.mix;
    const gains = { own: this.own ? Math.cos(m * Math.PI / 2) : 0, other: this.other ? Math.sin(m * Math.PI / 2) : 0 };
    for (const key of ['own', 'other']) this.chains[key].mix.gain.setTargetAtTime(gains[key], time, 0.015);
  }

  setFilters(chain, profile) {
    if (!profile) return;
    const settings = comparisonSettings(profile);
    const signature = settings.map(value => `${value.freq}/${value.db}`).join(':');
    if (chain.signature === signature) return;
    chain.signature = signature;
    chain.filters.forEach((filter, i) => {
      filter.frequency.value = settings[i].freq;
      filter.gain.value = settings[i].db;
    });
    // Log-spaced pink reference. Approximate level matching leaves the EQ shape audible.
    const ceiling = Math.min(20000, this.context.sampleRate * 0.49);
    const bands = Float32Array.from({ length: 48 }, (_, i) => 20 * (ceiling / 20) ** (i / 47));
    const mag = new Float32Array(bands.length), phase = new Float32Array(bands.length);
    const response = new Float32Array(bands.length).fill(1);
    for (const filter of chain.filters) {
      filter.getFrequencyResponse(bands, mag, phase);
      response.forEach((value, i) => { response[i] = value * mag[i]; });
    }
    const rms = Math.sqrt(response.reduce((sum, value) => sum + value ** 2, 0) / response.length);
    chain.level.gain.setTargetAtTime(Math.min(1.5, 1 / Math.max(0.1, rms)), this.context.currentTime, 0.02);
  }

  play() {
    if (!this.context) {
      const Context = window.AudioContext || window.webkitAudioContext;
      this.context = new Context();
      const source = this.context.createMediaElementSource(this.media);
      const output = this.context.createGain();
      output.gain.value = 0.23;
      output.connect(this.context.destination);
      this.chains = { own: this.createChain(source, output), other: this.createChain(source, output) };
      this.configure(this.own, this.other, this.mix);
    }
    // iOS requires both calls to start within the tap event.
    return Promise.all([this.context.resume(), this.media.play()]);
  }
}
