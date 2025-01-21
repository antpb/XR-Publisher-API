const updateMemory = async (updatedMemory) => {
    try {
      const response = await fetch(`${API_BASE_URL}/update-memory`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('xr_publisher_api_key')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: sessionData.sessionId,
          memoryId: updatedMemory.id,
          content: {
            text: updatedMemory.content.text,
            action: updatedMemory.content.action,
            model: updatedMemory.content.model || 'gpt-4'
          },
          type: updatedMemory.type,
          userId: 'antpb',
          importance_score: updatedMemory.importance_score,
          metadata: updatedMemory.metadata
        })
      });
      
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.details || 'Failed to update memory');
      }
      
      fetchMemories();
      setSelectedMemory(null);
    } catch (error) {
      console.error('Error updating memory:', error);
      alert(error.message);
    }
  }; 