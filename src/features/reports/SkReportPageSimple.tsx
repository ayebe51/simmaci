export default function SkReportPageSimple() {
  return (
    <div style={{ padding: '40px', fontFamily: 'Arial' }}>
      <h1 style={{ fontSize: '32px', marginBottom: '20px' }}>
        ✅ TEST PAGE - WORKING!
      </h1>
      <div style={{ 
        background: '#f0f0f0', 
        padding: '20px', 
        borderRadius: '8px',
        marginBottom: '20px'
      }}>
        <p style={{ fontSize: '18px', margin: '10px 0' }}>
          <strong>Status:</strong> Page rendered successfully! 🎉
        </p>
        <p style={{ fontSize: '14px', margin: '10px 0', color: '#666' }}>
          If you see this, the routing works and React is rendering.
        </p>
        <p style={{ fontSize: '14px', margin: '10px 0', color: '#666' }}>
          Timestamp: {new Date().toLocaleString('id-ID')}
        </p>
      </div>
      <div style={{ 
        background: '#e8f5e9', 
        padding: '20px', 
        borderRadius: '8px',
        border: '2px solid #4caf50'
      }}>
        <p style={{ fontSize: '16px', fontWeight: 'bold', color: '#2e7d32' }}>
          Next Step: Gradually add features back
        </p>
        <ul style={{ marginTop: '10px', color: '#666' }}>
          <li>Add user context ✓</li>
          <li>Add Convex queries</li>
          <li>Add filters & UI</li>
        </ul>
      </div>
    </div>
  )
}
