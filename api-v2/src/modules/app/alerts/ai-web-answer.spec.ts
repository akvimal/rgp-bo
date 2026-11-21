import { anthropicWebAnswer, openRouterWebAnswer } from './ai-provider';

describe('web search answers', () => {
  it('reads the text and url_citation sources of an OpenRouter reply', () => {
    const a = openRouterWebAnswer({ choices: [{ message: { content: '{"found": true}', annotations: [
      { type: 'url_citation', url_citation: { url: 'https://www.1mg.com/x', title: '1mg' } }, { type: 'other' }] } }] });
    expect(a.text).toBe('{"found": true}');
    expect(a.sources).toEqual([{ url: 'https://www.1mg.com/x', title: '1mg' }]);
  });
  it('copes with a reply that has no content or annotations', () => {
    expect(openRouterWebAnswer({})).toEqual({ text: '', sources: [] });
    expect(openRouterWebAnswer({ choices: [{ message: { content: [{ text: 'a' }, { text: 'b' }] } }] }).text).toBe('ab');
  });
  it('reads Anthropic text, its citations and the pages the search returned', () => {
    const a = anthropicWebAnswer({ content: [
      { type: 'server_tool_use', name: 'web_search' },
      { type: 'web_search_tool_result', content: [{ type: 'web_search_result', url: 'https://a.example/1', title: 'A' }] },
      { type: 'text', text: '{"found": true}', citations: [{ type: 'web_search_result_location', url: 'https://b.example/2', title: 'B' }] }] });
    expect(a.text).toBe('{"found": true}');
    expect(a.sources.map((s) => s.url)).toEqual(['https://b.example/2', 'https://a.example/1']);
  });
});
