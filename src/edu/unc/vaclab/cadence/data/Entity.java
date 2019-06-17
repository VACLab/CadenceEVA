package edu.unc.vaclab.cadence.data;

import org.apache.commons.json.JSONException;
import org.apache.commons.json.JSONObject;

import java.util.*;

public class Entity implements JSONSerializable {
	/**
	 * The unique entity ID
	 */
	protected final String id;
	
	/**
	 * Entity attributes data.
	 */
	private HashMap<AttributedDataType,Object> attributes = new HashMap<>();

	/**
	 * Events for the entity
	 */
	protected List<Event> eventList = new ArrayList();

	/**
	 * Flag to indicate if the event list is unsorted.
	 */
	private boolean unsortedEventList = false;

	/**
	 * Constructor
	 * @param _id The unique ID for the entity
	 */
	public Entity(String _id) {
		id = _id;
	}
	
	/**
	 * Accessor to the attributes for the entity.
	 */
	public Map<AttributedDataType,Object> getAttributes() {
		return attributes;
	}

	public void setAttributes(HashMap<AttributedDataType, Object> _attributes) {
		attributes = _attributes;
	}

	/**
	 * Access to the unique ID for this entity.
	 * @return
	 */
	public String getID() {
		return id;
	}
	
	/**
	 * Add an event to the event list of this entity
	 * @param _event
	 */
	public void addEvent(Event _event) {
		eventList.add(_event);
		unsortedEventList = true;
	}
	
	/**
	 * Access to the event list.
	 * @return The event list, never null.
	 */
	public List<Event> getEventList() {
		return eventList;
	}

	/**
	 * Access to the event list.
	 * @return The event list, never null.
	 */
	public void setEventList(List<Event> _events) {
		eventList = _events;
	}

	/**
	 * Serializes the Entity into a JSON object.
	 * TODO: Not yet fully implemented.
	 * @return
	 */
	@Override
	public JSONObject toJSON() throws JSONException {
		JSONObject json_obj = new JSONObject();
		json_obj.put("id", this.getID());
		return json_obj;
	}
}
