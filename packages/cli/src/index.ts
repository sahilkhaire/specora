#!/usr/bin/env node
import process from "node:process";
import { runCli } from "./app/run-cli.js";

void runCli(process.argv);
