// @vitest-environment jsdom
import {act,renderHook,waitFor,cleanup} from '@testing-library/react';
import {afterEach,it,expect,vi} from 'vitest';
import {useFastDeckPage} from './useFastDeckPage';
afterEach(()=>{cleanup();vi.unstubAllGlobals();});
it('shows the target before the network resolves and coalesces queued clicks to the latest page',async()=>{
 let finish!: (value:any)=>void;
 const fetcher=vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue({ok:true});
 vi.stubGlobal('fetch',fetcher);
 const refresh=vi.fn().mockResolvedValue(undefined);
 const {result}=renderHook(()=>useFastDeckPage('s','deck.pdf',1,refresh));
 act(()=>result.current.navigate(2));
 expect(result.current.page).toBe(2);
 act(()=>result.current.navigate(3));act(()=>result.current.navigate(4));
 expect(result.current.page).toBe(4);expect(fetcher).toHaveBeenCalledTimes(1);
 await act(async()=>finish({ok:true}));
 await waitFor(()=>expect(fetcher).toHaveBeenCalledTimes(2));
 expect(JSON.parse(fetcher.mock.calls[1][1].body)).toEqual({deckPage:4});
});
it('rolls back and exposes a failed write rather than silently keeping an unsaved page',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false}));
 const refresh=vi.fn().mockResolvedValue(undefined);
 const {result}=renderHook(()=>useFastDeckPage('s','deck.pdf',1,refresh));
 act(()=>result.current.navigate(2));
 await waitFor(()=>expect(result.current.error).toBe(true));
 expect(result.current.page).toBe(1);expect(refresh).toHaveBeenCalled();
});
it('only previews the current deck and retires the hint once the server catches up',()=>{
 const {result,rerender}=renderHook(({page})=>useFastDeckPage('s','deck.pdf',page,async()=>{}),{initialProps:{page:1}});
 act(()=>result.current.preview('other.pdf',9));expect(result.current.page).toBe(1);
 act(()=>result.current.preview('deck.pdf',2));expect(result.current.page).toBe(2);
 rerender({page:2});rerender({page:3});expect(result.current.page).toBe(3);
});
it('keeps the new page on screen when the read after saving brings nothing new (no flash back)',async()=>{
 // The read after the save can be superseded by the read the save's own
 // broadcast triggers, and resolve without new data. The old page must not
 // come back in between.
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}));
 const refresh=vi.fn().mockResolvedValue(undefined);
 const seen:number[]=[];
 const {result,rerender}=renderHook(({page})=>{const value=useFastDeckPage('s','deck.pdf',page,refresh);seen.push(value.page);return value;},{initialProps:{page:1}});
 act(()=>result.current.navigate(2));
 await waitFor(()=>expect(refresh).toHaveBeenCalled());
 await act(async()=>{});
 expect(result.current.page).toBe(2);
 rerender({page:2});
 expect(result.current.page).toBe(2);
 // Once the server shows it, later server pages are followed again.
 rerender({page:3});
 expect(result.current.page).toBe(3);
 expect(seen.slice(seen.indexOf(2))).not.toContain(1);
});
it('gives way to the server after a short hold if no read ever shows the saved page',async()=>{
 vi.useFakeTimers();
 try{
  vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}));
  const {result}=renderHook(()=>useFastDeckPage('s','deck.pdf',1,async()=>{}));
  act(()=>result.current.navigate(2));
  await act(async()=>{await vi.advanceTimersByTimeAsync(10);});
  expect(result.current.page).toBe(2);
  await act(async()=>{await vi.advanceTimersByTimeAsync(4000);});
  expect(result.current.page).toBe(1);
 }finally{vi.useRealTimers();}
});
it('lets a turn made in the other window replace a page already saved here',async()=>{
 vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:true}));
 const refresh=vi.fn().mockResolvedValue(undefined);
 const {result}=renderHook(()=>useFastDeckPage('s','deck.pdf',1,refresh));
 act(()=>result.current.navigate(2));
 await waitFor(()=>expect(refresh).toHaveBeenCalled());
 await act(async()=>{});
 act(()=>result.current.preview('deck.pdf',5));
 expect(result.current.page).toBe(5);
});
it('lets a turn from the other window win over a page still being saved here',async()=>{
 let finish!: (value:any)=>void;
 vi.stubGlobal('fetch',vi.fn().mockImplementationOnce(()=>new Promise(r=>{finish=r;})).mockResolvedValue({ok:true}));
 const refresh=vi.fn().mockResolvedValue(undefined);
 const {result}=renderHook(()=>useFastDeckPage('s','deck.pdf',1,refresh));
 act(()=>result.current.navigate(2));
 act(()=>result.current.preview('deck.pdf',3));
 expect(result.current.page).toBe(3);
 // The earlier save finishing here does not take the screen back.
 await act(async()=>finish({ok:true}));
 await waitFor(()=>expect(refresh).toHaveBeenCalled());
 await act(async()=>{});
 expect(result.current.page).toBe(3);
});
