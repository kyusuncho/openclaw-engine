Here is what you need to do right now to validate this engine before we start building the Clawster Orchestrator.

### Step 1: The "Jar Test" (Local Container Validation)

Before we build the system that manages a hundred of these containers, we need to prove that one single container works in isolation. You need to build and run this image manually.

Run these commands in your terminal:

```bash
# 1. Build the Docker image
docker build -t clawster-engine:latest -f Dockerfile.agent-engine .

# 2. Create the mock bounded directories on your host machine
mkdir -p ./mock_system/agents/main/agent
mkdir -p ./mock_workspace

# 3. Create a basic identity.md so the agent knows who it is
echo "You are a helpful coding assistant." > ./mock_workspace/IDENTITY.md

# 4. Inject your API key into an env file
echo "OPENAI_API_KEY=sk-your-actual-api-key-here" > ./mock_system/.env

# 5. Run the container, mounting the local folders and exposing the port
docker run -p 50051:50051 \
  --env-file ./mock_system/.env \
  -v $(pwd)/mock_system:/app/system \
  -v $(pwd)/mock_workspace:/app/workspace \
  clawster-engine:latest

```

### Step 2: The "Pulse Check" (ACP Payload Test)

With the container running, open a new terminal tab and send it a manual Hive-ACP payload using `curl`. We are pretending to be the Gateway.

```bash
curl -X POST http://localhost:50051/execute \
  -H "Content-Type: application/json" \
  -d '{
    "sender_id": "user_123",
    "intent": "call",
    "message": "Please write a simple python hello world script and save it to the workspace folder.",
    "workspace_pointers": ["/app/workspace/"]
  }'

```

**What you should see:**

1. The `curl` command should return a successful JSON response with the agent's reply.
2. More importantly, if you look inside your `./mock_workspace/` folder on your host machine, you should physically see the new Python script the agent created.

### Step 3: Moving to the Clawster Orchestrator

If that test works, the "Brain Extraction" is officially complete. You now have a reliable, containerized LLM worker node.
