# Product Overview

Automated newsletter delivery system that generates and distributes topic-based newsletters via GitHub Actions. The system fetches theme configurations from Firestore, performs web searches based on prompts, generates newsletter content, and delivers to subscribers through Resend API.

## Core Capabilities

- **Automated Content Generation**: Web search and AI-based newsletter creation from configured themes
- **Scheduled Delivery**: Weekly automated execution (Monday 9:00 JST) with on-demand trigger support
- **Subscriber Management**: Firestore-based subscriber lists per theme
- **Secure Authentication**: Keyless GCP access via Workload Identity Federation

## Target Use Cases

- System administrators managing multiple newsletter themes without manual content creation
- Subscribers receiving curated news on specific topics at regular intervals
- Organizations automating their content distribution pipeline

## Value Proposition

Eliminates manual newsletter creation by combining web search, content generation, and email delivery in a single automated workflow. No infrastructure to manage (serverless via GitHub Actions), no service account keys to rotate (WIF authentication), and flexible theme/subscriber management through Firestore.

---
_Focus on patterns and purpose, not exhaustive feature lists_
