import { createClientFromRequest } from 'npm:@base44/sdk@0.8.6';

Deno.serve(async (req) => {
  try {
    const base44 = createClientFromRequest(req);
    
    // Scheduled / workflow-invoked function — admin only. Fails closed.
    const user = await base44.auth.me().catch(() => null);
    if (!user || user.role !== 'admin') {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

    const now = new Date();
    const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const in25Hours = new Date(now.getTime() + 25 * 60 * 60 * 1000);
    
    // Fetch active testing requirements with deadlines in the next 24-25 hours
    const allTestingReqs = await base44.asServiceRole.entities.TestingRequirement.filter({
      is_required: true,
      status: 'ACTIVE'
    });

    const upcomingDeadlines = allTestingReqs.filter(req => {
      if (!req.deadline_at) return false;
      const deadline = new Date(req.deadline_at);
      return deadline > in24Hours && deadline < in25Hours;
    });

    const results = [];

    for (const testingReq of upcomingDeadlines) {
      try {
        await base44.asServiceRole.functions.invoke('sendTestingNotification', {
          collaboration_id: testingReq.collaboration_id,
          notification_type: 'deadline_approaching'
        });

        results.push({
          collaboration_id: testingReq.collaboration_id,
          deadline_at: testingReq.deadline_at
        });
      } catch (error) {
        console.error(`Failed to send warning for ${testingReq.collaboration_id}:`, error);
      }
    }

    return Response.json({
      success: true,
      message: `Sent ${results.length} deadline warnings`,
      warnings_sent: results.length,
      results
    });

  } catch (error) {
    console.error('Testing deadline warning error:', error);
    return Response.json({ 
      error: error.message 
    }, { status: 500 });
  }
});