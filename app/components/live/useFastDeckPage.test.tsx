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
