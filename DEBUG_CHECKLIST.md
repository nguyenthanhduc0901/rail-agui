# Debugging Checklist - Message 3-4 Not Responding

## Steps to Debug

### 1. Enable Debug Mode
```bash
# Set environment variable
export COPILOT_DEBUG=1
# or in .env.local:
COPILOT_DEBUG=1
```

### 2. Open Browser DevTools
- **F12** → Console tab
- Keep it open while testing

### 3. Open Terminal with Logs
- Look at `pnpm dev` output
- Next.js server logs should show:
  ```
  [copilot] incoming request { messageCount: X, ... }
  [guard] check { messageCount: X, isRunning: false }
  [guard] trimming from X to 5 (if needed)
  [copilot] outgoing response { status: 200, elapsed: Xms }
  ```

### 4. Test Flow
1. Open http://localhost:3000/rail-dashboard
2. Message 1: "hi" → Should respond naturally
3. Message 2: "tổng quan đội tàu" → Should call `get_fleet_overview` tool
4. Message 3: "bao nhiêu sự cố" → Should respond (THIS IS WHERE IT FAILS?)
5. Message 4-5: Continue testing

### 5. Monitor & Collect Data

**Browser Console (F12 → Console):**
- Watch for errors
- Log message count
- Log guard activity

**Terminal (pnpm dev output):**
- Watch [copilot] logs
- Watch [guard] logs
- Look for timeouts or errors

**Browser Network Tab (F12 → Network):**
- Check `/api/copilotkit` requests
- See request payload
- See response status & duration

### 6. Key Things to Check

| Item | Expected | Check |
|------|----------|-------|
| Guard message count | ≤ 5 | `[guard]` log |
| Agent running status | false (when responding) | `[guard] isRunning` |
| Route handler response | status 200 | `[copilot] outgoing response` |
| Backend timeout | no timeout | elapsed < 45000ms |
| Stream format | event-stream | Network tab |

### 7. If You See Issues

**If guard is trimming too aggressively:**
- Check: `[guard] trimming from X to 5`
- Consider increasing `MAX_MESSAGES` from 5

**If agent is running forever:**
- Check: `[guard] agent running, skip trim` keeps appearing
- Indicates agent.isRunning stuck at true
- Check backend for hanging requests

**If route handler hangs:**
- Check: no `[copilot] outgoing response` log
- Indicates request timeout or crash
- Check browser Network tab for pending requests

**If messages format is wrong:**
- Enable debug in browser console
- Log `agent.messages` structure
- Compare with trace from earlier

## Debug Commands

```bash
# Enable all debug output
export COPILOT_DEBUG=1
export AGENT_TOOL_DEBUG=1

# Run with debugging
pnpm dev

# Check LangSmith traces
# Go to: https://smith.langchain.com/projects/rail-agui
```

## Next Steps

Run through steps 1-5 above, then share:
1. Browser console logs (screenshot or paste)
2. Terminal output (paste last 50 lines)
3. Network tab showing `/api/copilotkit` request/response
4. At what message number it stops responding

This will help identify if issue is:
- .Frontend (React Component, Hook)
- .Route handler (Next.js API)
- .Backend (Agent/LangGraph)
- .Communication (Message format, timeout)
