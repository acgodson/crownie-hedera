import { TranscriptionService } from './src/services/TranscriptionService.js';

const transcriptionService = new TranscriptionService();

console.log('🧪 Testing FIFO Queue Implementation');

async function testQueue() {
  try {
    console.log('1. Creating transcription session...');
    const session = await transcriptionService.startSession(
      'test_meeting_123',
      'test_topic_456',
      'meeting_789'
    );
    console.log('✅ Session created:', session.sessionId);

    console.log('\n2. Adding multiple segments to queue...');
    
    // Add 3 segments quickly - they should queue and process one by one
    const segments = await Promise.all([
      transcriptionService.processAudioSegment(session.sessionId, 'fake_audio_1', 0, 1000, 1),
      transcriptionService.processAudioSegment(session.sessionId, 'fake_audio_2', 1000, 2000, 2),
      transcriptionService.processAudioSegment(session.sessionId, 'fake_audio_3', 2000, 3000, 3)
    ]);

    console.log('✅ Segments queued:', segments.length);

    console.log('\n3. Waiting for queue processing...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    console.log('\n4. Checking final session state...');
    const finalSession = await transcriptionService.getSession(session.sessionId);
    
    console.log('📊 Final Results:');
    console.log('- Total segments:', finalSession.segments.length);
    console.log('- Processed segments:', finalSession.processedSegmentIds.length);
    console.log('- Queue count:', finalSession.queuedSegmentCount);
    console.log('- Segments status:', finalSession.segments.map(s => `${s.segmentId}: ${s.status}`));

    console.log('\n🎉 Queue test completed!');
  } catch (error) {
    console.error('❌ Queue test failed:', error);
  }
}

testQueue();