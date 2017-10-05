" init.vim
" Entry point for oni-interop plugin

if exists("g:loaded_oni_interop_plugin")
    finish
endif

let g:loaded_oni_interop_plugin = 1

function OniNotify(args)
    call rpcnotify(1, "oni_plugin_notify", a:args)
endfunction

function OniNoop()

endfunction

function OniNotifyBufferUpdate()

    if !exists("b:last_change_tick")
        let b:last_change_tick = -1
    endif

    if b:changedtick > b:last_change_tick
        let b:last_change_tick = b:changedtick
        if mode() == 'i'
            let buffer_line = getline(".")
            let context = OniGetContext()
            call OniNotify(["incremental_buffer_update", context, buffer_line, line(".")])
        else
            let buffer_lines = getline(1,"$")
            let context = OniGetContext()
            call OniNotify(["buffer_update", context, buffer_lines])
        endif
    endif
endfunction

function OniNotifyEvent(eventName)
    let context = OniGetContext()
    call OniNotify(["event", a:eventName, context])
endfunction

function OniCommand(oniCommand)
    call OniNotify(["oni_command", a:oniCommand])
endfunction

function OniOpenFile(strategy, file)
     if bufname('%') != ''
         exec a:strategy . a:file
     elseif &modified
         exec a:strategy . a:file
     else
         exec ":e " . a:file
     endif
 endfunction

augroup OniClipboard
    autocmd!
    autocmd! TextYankPost * :call OniNotifyYank(v:event)
augroup end

" Prevent 'no matching autocommand' message if FocusLost/FocusGained
" aren't registered
augroup OniNoop
    autocmd!
    autocmd! FocusLost * :call OniNoop()
    autocmd! FocusGained * :call OniNoop()
augroup END

augroup OniNotifyBufferUpdates
    autocmd!
    autocmd! CursorMovedI * :call OniNotifyBufferUpdate()
    autocmd! BufEnter * :call OniNotifyBufferUpdate()
    autocmd! CursorMoved * :call OniNotifyBufferUpdate()
    autocmd! InsertLeave * :call OniNotifyBufferUpdate()
    autocmd! InsertChange * :call OniNotifyBufferUpdate()
    autocmd! InsertEnter * :call OniNotifyBufferUpdate()
augroup END

augroup OniNotifyWindowDisplayUpdate
    autocmd!
    autocmd! BufEnter * :call OniUpdateWindowDisplayMap(1)
    autocmd! BufWinEnter * :call OniUpdateWindowDisplayMap(1)
    autocmd! WinEnter * :call OniUpdateWindowDisplayMap(1)
    autocmd! VimResized * :call OniUpdateWindowDisplayMap(1)
    autocmd! CursorMoved * :call OniUpdateWindowDisplayMap(0)
    autocmd! InsertLeave * :call OniUpdateWindowDisplayMap(0)
    autocmd! InsertEnter * :call OniUpdateWindowDisplayMap(0)
augroup END

augroup OniEventListeners
    autocmd!
    autocmd! BufWritePre * :call OniNotifyEvent("BufWritePre")
    autocmd! BufWritePost * :call OniNotifyEvent("BufWritePost")
    autocmd! BufEnter * :call OniNotifyEvent("BufEnter")
    autocmd! WinEnter * :call OniNotifyEvent("WinEnter")
    autocmd! BufLeave * :call OniNotifyEvent("BufLeave")
    autocmd! BufDelete * :call OniNotifyEvent("BufDelete")
    autocmd! WinLeave * :call OniNotifyEvent("WinLeave")
    autocmd! CursorMoved * :call OniNotifyEvent("CursorMoved")
    autocmd! CursorMovedI * :call OniNotifyEvent("CursorMovedI")
    autocmd! InsertLeave * :call OniNotifyEvent("InsertLeave")
    autocmd! InsertEnter * :call OniNotifyEvent("InsertEnter")
    autocmd! DirChanged * :call OniNotifyEvent("DirChanged")
augroup END

function OniGetContext()
let context = {}
let context.bufferNumber = bufnr("%")
let context.bufferFullPath = expand("%:p")
let context.bufferTotalLines = line("$")
let context.line = line(".")
let context.column = col(".")
let context.mode = mode()
let context.windowNumber = winnr()
let context.winline = winline()
let context.wincol = wincol()
let context.windowTopLine = line("w0")
let context.windowBottomLine = line("w$")
let context.byte = line2byte(line(".")) + col(".")
let context.filetype = eval("&filetype")
let context.modified = &modified
let context.hidden = &hidden
let context.listed = &buflisted

if exists("b:last_change_tick")
    let context.version = b:last_change_tick
endif

return context
endfunction

function OniUpdateWindowDisplayMap(shouldMeasure)
    let currentWindowNumber = winnr()
    let pos = getpos(".")
    let bufNum = pos[0]
    let currentLine = pos[1]
    let currentColumn = pos[2]

    let windowStartLine = line('w0')
    let windowEndLine = line('w$')

    let mapping = {}

    let cursor = windowStartLine

    while(cursor <= windowEndLine)
        call setpos(".", [bufNum, cursor, 0])
        let cursorString = string(cursor)
        let mapping[cursorString] = winline()
        let cursor = cursor+1
    endwhile

    call setpos(".", [bufNum, currentLine, currentColumn])

    let context = OniGetContext()

    call OniNotify(["window_display_update", context, mapping, a:shouldMeasure])
endfunction

function OniConnect()
    call OniApiInfo()

    " Force BufEnter and buffer update events to be dispatched on connection
    " Otherwise, there can be race conditions where the buffer is loaded
    " prior to the UI attaching. See #122
    call OniNotifyEvent("BufEnter")
    call OniNotifyBufferUpdate()
endfunction

function OniNotifyYank(yankEvent)
    call OniNotify(["oni_yank", a:yankEvent])
endfunction


function OniApiInfo()
    if (has_key(api_info(),'version'))
        call OniNotify(["api_info",api_info()["version"]])
    else
        call OniNotify(["api_info",{"api_level":0}])
    endif
endfunction


" Window navigation excerpt from:
" http://blog.paulrugelhiatt.com/vim/2014/10/31/vim-tip-automatically-create-window-splits-with-movement.html

function! s:GotoNextWindow( direction )
  let l:prevWinNr = winnr()
  execute 'wincmd' a:direction
  return winnr() != l:prevWinNr
endfunction

function! OniNextWindow( direction )
  if ! s:GotoNextWindow(a:direction)
    if a:direction == 'h'
      call OniCommand("window.moveLeft")
    elseif a:direction == 'j'
      call OniCommand("window.moveDown")
    elseif a:direction == 'k'
      call OniCommand("window.moveUp")
    elseif a:direction == 'l'
      call OniCommand("window.moveRight")
    endif
    execute 'wincmd' a:direction
  endif
endfunction

nnoremap <silent> <C-w>h :<C-u>call OniNextWindow('h')<CR>
nnoremap <silent> <C-w>j :<C-u>call OniNextWindow('j')<CR>
nnoremap <silent> <C-w>k :<C-u>call OniNextWindow('k')<CR>
nnoremap <silent> <C-w>l :<C-u>call OniNextWindow('l')<CR>
nnoremap <silent> <C-w><C-h> :<C-u>call OniNextWindow('h')<CR>
nnoremap <silent> <C-w><C-j> :<C-u>call OniNextWindow('j')<CR>
nnoremap <silent> <C-w><C-k> :<C-u>call OniNextWindow('k')<CR>
nnoremap <silent> <C-w><C-l> :<C-u>call OniNextWindow('l')<CR>
